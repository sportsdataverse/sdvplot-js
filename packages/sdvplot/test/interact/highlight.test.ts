// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { STANDINGS } from "../../../sdvtables/test/fixtures/standings.js";
import { loadLeague } from "../../src/index.js";
import { highlight } from "../../src/interact/index.js";
import { axisLogos, linkIds } from "../../src/plot/index.js";

interface Pt {
  id: string;
  x: number;
  y: number;
}
/** Real points: the vertices of sportyR's NBA court polygons, the committed parity oracle (fixtures/sporty). */
function courtVertices(n: number): Pt[] {
  // jsdom's global URL resolves relative paths against http://localhost:3000, so build a file path instead
  const dir = join(fileURLToPath(import.meta.url), "../../../../../fixtures/sporty/basketball/nba");
  const out: Pt[] = [];
  for (const f of readdirSync(dir)
    .filter((name) => name.startsWith("layer_"))
    .sort()) {
    const lines = readFileSync(join(dir, f), "utf8").trim().split(/\r?\n/).slice(1);
    lines.forEach((line, i) => {
      const [x, y] = line.split(",");
      out.push({ id: `${f.slice(6, 9)}:${i}`, x: Number(x), y: Number(y) });
    });
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}
const lit = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll(".sdv-hl")).map((e) => e.getAttribute("data-sdv-id"));
/** What the appended dimming rule matches: its own selector, run against the figure. */
const dimmed = (root: Element): Element[] => {
  const css = root.querySelector("style[data-sdv-interact]")?.textContent ?? "";
  return Array.from(root.querySelectorAll(css.slice(0, css.indexOf("{"))));
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
/** Move the pointer onto a drawn circle (jsdom has no layout: Plot reads clientX/Y as svg coordinates). */
const pointAt = (svg: Element, c: Element | null | undefined): void => {
  svg.dispatchEvent(
    new MouseEvent("pointermove", {
      clientX: Number(c?.getAttribute("cx")),
      clientY: Number(c?.getAttribute("cy")),
    }),
  );
};

beforeAll(() => loadLeague("nfl"));

test("10,000 points: a hover changes two marks' classes and the root's, and never redraws (Review Focus 4)", () => {
  const pts = courtVertices(10_000);
  expect(pts).toHaveLength(10_000);
  const svg = Plot.plot({ marks: [Plot.dot(pts, { x: "x", y: "y", r: 1, render: linkIds(pts, "id") })] });
  const first = svg.querySelector("circle");
  expect(svg.querySelectorAll("circle[data-sdv-id]")).toHaveLength(10_000);
  highlight(svg, null); // builds the id index once and adds the dimming rule
  const mo = new MutationObserver(() => {});
  mo.observe(svg, { attributes: true, childList: true, subtree: true });
  highlight(svg, new Set([pts[0]?.id ?? ""]));
  const enter = mo.takeRecords();
  highlight(svg, new Set([pts[9_999]?.id ?? ""]));
  const move = mo.takeRecords();
  highlight(svg, new Set([pts[9_999]?.id ?? "", pts[1]?.id ?? ""]));
  const widen = mo.takeRecords();
  mo.disconnect();
  expect(enter.map((r) => r.type)).toEqual(["attributes", "attributes"]); // the mark gains sdv-hl, the root sdv-focus
  expect(move.map((r) => r.type)).toEqual(["attributes", "attributes"]); // one mark loses it, one gains it
  expect(widen.map((r) => r.type)).toEqual(["attributes"]); // the mark still lit is not touched again
  expect(svg.querySelector("circle")).toBe(first);
  expect(lit(svg)).toEqual([pts[1]?.id, pts[9_999]?.id]);
});
test("null clears, an empty set dims everything, and ids absent from the figure are returned, not thrown", () => {
  const svg = Plot.plot({
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", render: linkIds(STANDINGS, "team") })],
  });
  expect(highlight(svg, new Set(["KC", "NE", "SEA"]))).toEqual(["NE", "SEA"]); // NE: null net_epa, no dot
  expect(svg.classList.contains("sdv-focus")).toBe(true);
  expect(lit(svg)).toEqual(["KC"]);
  expect(dimmed(svg)).toHaveLength(6);
  highlight(svg, new Set());
  expect(svg.classList.contains("sdv-focus")).toBe(true);
  expect(lit(svg)).toEqual([]);
  expect(dimmed(svg)).toHaveLength(7);
  highlight(svg, null);
  expect(svg.classList.contains("sdv-focus")).toBe(false);
  expect(dimmed(svg)).toHaveLength(0);
  expect(svg.querySelectorAll("style[data-sdv-interact]")).toHaveLength(1);
});
test("the caller's set is copied: mutating it later does not desync the next call", () => {
  const svg = Plot.plot({
    marks: [Plot.barY(STANDINGS, { x: "team", y: "wins", render: linkIds(STANDINGS, "team") })],
  });
  const ids = new Set(["KC", "BUF"]);
  highlight(svg, ids);
  ids.delete("BUF");
  highlight(svg, new Set(["LV"]));
  expect(lit(svg)).toEqual(["LV"]);
});
test("a pointer layer drawn after the root is indexed is lit, and its replaced nodes leave the index (A28)", async () => {
  const at = { x: "wins", y: "net_epa", render: linkIds(STANDINGS, "team") } as const;
  const svg = Plot.plot({
    marks: [Plot.dot(STANDINGS, at), Plot.dot(STANDINGS, Plot.pointer({ ...at, r: 9 }))],
  });
  const point = (team: string): void => pointAt(svg, svg.querySelector(`circle[data-sdv-id="${team}"]`));
  highlight(svg, new Set(["KC"])); // indexes the root while the pointer layer is still empty
  point("KC"); // Plot's pointer draws a NEW KC dot; no store write, so no highlight call follows
  expect(svg.querySelectorAll('[data-sdv-id="KC"]')).toHaveLength(2);
  await tick();
  expect(lit(svg)).toEqual(["KC", "KC"]);
  point("BUF"); // the pointer's KC dot is replaced by a BUF dot
  expect(highlight(svg, new Set(["BUF"]))).toEqual([]); // drained synchronously, before the observer's callback
  expect(lit(svg)).toEqual(["BUF", "BUF"]);
  expect(svg.querySelectorAll('[data-sdv-id="KC"]')).toHaveLength(1);
});
test("an id whose only mark the pointer replaced is reported missing again (A28)", () => {
  const svg = Plot.plot({
    marks: [
      Plot.dot(STANDINGS, { x: "wins", y: "net_epa" }), // unstamped: only something to point at
      Plot.dot(
        STANDINGS,
        Plot.pointer({ x: "wins", y: "net_epa", r: 9, render: linkIds(STANDINGS, "team") }),
      ),
    ],
  });
  const [kc, , , , buf] = Array.from(svg.querySelectorAll("circle")); // KC LAC DEN LV BUF MIA NYJ (NE: no dot)
  expect(highlight(svg, new Set(["KC"]))).toEqual(["KC"]); // nothing pointed yet
  pointAt(svg, kc);
  expect(highlight(svg, new Set(["KC"]))).toEqual([]);
  pointAt(svg, buf);
  expect(highlight(svg, new Set(["KC"]))).toEqual(["KC"]);
});
test("axis logos never dim and are not marks: they carry ESPN ids, but only data marks are indexed (A28)", () => {
  const svg = Plot.plot({
    marks: [
      Plot.barY(STANDINGS, { x: "team", y: "wins", render: linkIds(STANDINGS, "team") }),
      axisLogos("x", { league: "nfl" }),
    ],
  });
  const logos = Array.from(svg.querySelectorAll("image[data-sdv-axis][data-sdv-id]"));
  expect(logos).toHaveLength(8);
  const kcEspn = logos.find((l) => l.getAttribute("data-sdv-id") === "12");
  expect(kcEspn).toBeDefined();
  expect(highlight(svg, new Set(["KC"]))).toEqual([]);
  expect(dimmed(svg).map((e) => e.getAttribute("data-sdv-id"))).toEqual([
    "LAC",
    "DEN",
    "LV",
    "BUF",
    "MIA",
    "NYJ",
    "NE",
  ]);
  expect(highlight(svg, new Set(["12"]))).toEqual(["12"]); // KC's ESPN id names no data mark here
  expect(kcEspn?.classList.contains("sdv-hl")).toBe(false);
});
