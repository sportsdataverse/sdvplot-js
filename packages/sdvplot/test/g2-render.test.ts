// @vitest-environment jsdom
import { Chart } from "@antv/g2";
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { STANDINGS } from "../../sdvtables/test/fixtures/standings.js";
import { axisLogos, logoMark, teamColorScale } from "../src/g2.js";
import { logoUrlSync, resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import "./_fixtures.js";

/**
 * A real G2 5.4.8 render (its canvas renderer on @napi-rs/canvas, jsdom has no 2D canvas): what G2 builds from the
 * sdvplot pieces, read back from its own scene graph. Pixels are the Chromium render test's
 * (examples/test/interactive.test.ts); here, where each image lands.
 */
const proto = HTMLCanvasElement.prototype;
const saved = Object.getOwnPropertyDescriptor(proto, "getContext");
beforeAll(() => {
  const backing = new WeakMap<HTMLCanvasElement, Canvas>();
  Object.defineProperty(proto, "getContext", {
    configurable: true,
    value(this: HTMLCanvasElement, kind: "2d") {
      const c = backing.get(this) ?? createCanvas(this.width || 300, this.height || 150);
      backing.set(this, c);
      return c.getContext(kind);
    },
  });
});
afterAll(() => {
  if (saved !== undefined) Object.defineProperty(proto, "getContext", saved);
});
beforeEach(() => resetWarnings());

const WEST = STANDINGS.filter((r) => r.division === "West").map((r) => ({ ...r }));
const ID = (t: string) => resolveSync(t, "nfl") as string;

interface GNode {
  nodeName: string;
  style: Record<string, unknown>;
  getBounds(): { center: number[]; halfExtents: number[] };
}
async function draw(options: object): Promise<{ chart: Chart; find: (sel: string) => GNode[] }> {
  const chart = new Chart({
    container: document.body.appendChild(document.createElement("div")),
    width: 480,
    height: 320,
  });
  chart.options({ ...options, animate: false } as Parameters<Chart["options"]>[0]);
  await chart.render();
  const doc = chart.getContext().canvas?.document;
  if (doc === undefined) throw new Error("G2 built no canvas");
  return { chart, find: (sel) => doc.querySelectorAll(sel) as unknown as GNode[] };
}
/** An element's centre, rounded to 0.01 px. */
const centre = (n: GNode): number[] =>
  n
    .getBounds()
    .center.slice(0, 2)
    .map((v) => Math.round(v * 100) / 100);
const ofMark = (find: (sel: string) => GNode[], type: string): GNode[] =>
  find(".element").filter((e) => (e as unknown as { markType: string }).markType === type);

test("logoMark in a view's children: G2 draws one image per team, the logo, centred on that team's point", async () => {
  const { find } = await draw({
    type: "view",
    data: WEST,
    children: [
      { type: "point", encode: { x: "pf", y: "pa" } },
      logoMark(WEST, { x: "pf", y: "pa", team: "team", league: "nfl", size: 28, alpha: 0.9 }),
    ],
  });
  const images = ofMark(find, "image");
  expect(images.map((i) => i.nodeName)).toEqual(["image", "image", "image", "image"]);
  expect(images.map((i) => i.style.src)).toEqual(WEST.map((r) => logoUrlSync(r.team, "nfl")));
  for (const i of images) expect([i.style.width, i.style.height, i.style.opacity]).toEqual([28, 28, 0.9]);
  expect(images.map(centre)).toEqual(ofMark(find, "point").map(centre));
});

test("teamColorScale is G2's scale.color; the image mark carries its rows, for a view's encode and the caller's callbacks", async () => {
  const teams = WEST.map((r) => r.team);
  const scale = teamColorScale("nfl", teams, { background: "#141414" });
  const logos = logoMark(WEST, { x: "pf", y: "pa", team: "team", league: "nfl" });
  const { chart, find } = await draw({
    type: "view",
    data: WEST,
    encode: { x: "pf", y: "pa", color: "team" },
    scale: { color: scale },
    children: [
      { type: "point", style: { fillOpacity: 1 } },
      // a caller's own style on the mark: fade each logo by its row's wins
      { ...logos, style: { ...logos.style, opacity: (d: { wins: number }) => d.wins / 20 } },
    ],
  });
  expect(ofMark(find, "point").map((p) => p.style.stroke)).toEqual(scale.range);
  expect(chart.getScaleByChannel("color")?.getOptions().domain).toEqual(teams);
  expect(ofMark(find, "image").map((i) => i.style.opacity)).toEqual(WEST.map((r) => r.wins / 20));
});

// Where the logo lands in its box is the page's layout (jsdom has none): the Chromium render test checks each logo sits
// on its column. Here, what G2 asks the page to draw, and where it puts each box.
test("axisLogos on a column chart's x axis: one HTML label per band, its box on its column's tick, the logo at its height; an unknown team keeps its text", async () => {
  const rows = [...WEST, { team: "XXX", wins: 1 }];
  const warned: string[] = [];
  setWarningHandler((m) => warned.push(m));
  const { find } = await draw({
    type: "interval",
    data: rows,
    encode: { x: "team", y: "wins" },
    axis: { x: axisLogos({ league: "nfl", size: 26 }) },
  });
  setWarningHandler(null);
  const labels = find("html");
  expect(labels).toHaveLength(5);
  const html = labels.map((l) => String(l.style.innerHTML));
  WEST.forEach((r, i) => {
    expect(html[i]).toContain(`src="${logoUrlSync(r.team, "nfl")}"`);
    expect(html[i]).toContain(`data-sdv-id="${ID(r.team)}"`);
    expect(labels[i]?.style.height).toBe(26); // G2 read the height from the img's inline style
  });
  expect(html[4]).toMatch(/^<span[^>]*>XXX<\/span>$/);
  // @antv/component 2.1.12 puts each label box's left edge on its tick (the column's centre); the label's HTML centres
  // itself there (2.1.11 centred the box instead: a change of version shows here)
  const left = labels.map((l) => {
    const b = l.getBounds();
    return Math.round(((b.center[0] ?? 0) - (b.halfExtents[0] ?? 0)) * 100) / 100;
  });
  expect(left).toEqual(ofMark(find, "interval").map((b) => centre(b)[0]));
  expect(warned).toHaveLength(1);
});

test("a vertical team axis (transpose): the guide's logoMark at each bar's base is centred on the axis line, beside its bar", async () => {
  const { find } = await draw({
    type: "view",
    data: WEST,
    coordinate: { transform: [{ type: "transpose" }] },
    axis: { x: { label: false } },
    children: [
      { type: "interval", encode: { x: "team", y: "wins" } },
      logoMark(
        WEST.map((r) => ({ team: r.team, base: 0 })),
        { x: "team", y: "base", team: "team", league: "nfl", size: 22 },
      ),
    ],
  });
  const bars = ofMark(find, "interval").map((b) => b.getBounds());
  const logos = ofMark(find, "image").map(centre);
  expect(logos).toHaveLength(4);
  // every logo on one vertical line, the bars' left edge (their base), each at its own bar's height
  for (const [i, [x, y]] of logos.entries()) {
    const bar = bars[i];
    expect(x).toBeCloseTo((bar?.center[0] ?? 0) - (bar?.halfExtents[0] ?? 0), 1);
    expect(y).toBeCloseTo(bar?.center[1] ?? 0, 1);
  }
});
