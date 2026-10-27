// @vitest-environment jsdom
import { defineChart, dot, lineY } from "@tanstack/charts";
import { mountChart } from "@tanstack/charts/dom";
import { serializeChartSvg } from "@tanstack/charts/export";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { renderChartSvg } from "@tanstack/charts/svg";
import { beforeAll, beforeEach, expect, test } from "vitest";
import { loadLeague, logoUrlSync, resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import {
  type TanstackImageDot,
  logoDots,
  teamColorPalette,
  teamColorScale,
  withPatterns,
} from "../src/tanstack.js";
import "./_fixtures.js";

/**
 * A real TanStack Charts 1.1.0 render (its default SVG host, `mountChart`, in jsdom): where TanStack puts each logo
 * dot, read back from the SVG it reconciles. Pixels are the Chromium render test's (examples/test/interactive.test.ts).
 */
beforeAll(() => loadLeague("nfl"));
beforeEach(() => resetWarnings());

const ID = (t: string) => resolveSync(t, "nfl") as string;
const W = 480;
const H = 320;

/** Mount a chart of `marks` with the dots' patterns; resolves to its container once TanStack has drawn. */
async function draw(
  marks: unknown[],
  dots: readonly (readonly TanstackImageDot<object>[])[],
  extra: object = {},
): Promise<{
  el: HTMLElement;
  update: (marks: unknown[], ...d: (readonly TanstackImageDot<object>[])[]) => Promise<void>;
}> {
  const el = document.body.appendChild(document.createElement("div"));
  const options = (m: unknown[], d: readonly (readonly TanstackImageDot<object>[])[]) => ({
    // the marks are built (and type-checked against dot()) at each call site; here any mix of them
    definition: defineChart({
      marks: m,
      scales: { x: { scale: scaleLinear, nice: true }, y: { scale: scaleLinear, nice: true } },
      ...extra,
    } as never),
    width: W,
    height: H,
    ariaLabel: "test chart",
    idPrefix: "t1",
    renderSvg: withPatterns(renderChartSvg, ...d),
  });
  const host = mountChart(el, options(marks, dots) as never);
  const settle = () => new Promise((r) => setTimeout(r, 20));
  await settle();
  return {
    el,
    update: async (m, ...d) => {
      host.update(options(m, d) as never);
      await settle();
    },
  };
}
const circles = (el: HTMLElement, markId: string) =>
  [...el.querySelectorAll(`g[data-ts-key="${markId}"] > circle`)].map((c) => ({
    key: c.getAttribute("data-ts-key") ?? "",
    cx: Number(c.getAttribute("cx")),
    cy: Number(c.getAttribute("cy")),
    r: Number(c.getAttribute("r")),
    fill: c.getAttribute("fill") ?? "",
  }));

// each team's 2024 points for and against, from the standings fixture's AFC West
const WEST = [
  { team: "KC", espn: 12, pf: 385, pa: 326 },
  { team: "LAC", espn: 24, pf: 402, pa: 301 },
  { team: "DEN", espn: 7, pf: 425, pa: 311 },
  { team: "LV", espn: 13, pf: 309, pa: 434 },
];

test.each([
  ["abbreviations", "team"],
  ["numeric ESPN ids", "espn"],
] as const)(
  "each logo dot sits exactly on TanStack's own point for its row, filled with its team's logo (%s)",
  async (_, field) => {
    const rows = WEST.map((r, i) => ({ ...r, i }));
    const logos = logoDots(rows, { x: "pf", y: "pa", team: field, league: "nfl", size: 28 });
    // a plain TanStack dot over the same rows: where TanStack itself puts each row
    const ref = dot(rows, { id: "ref", x: "pf", y: "pa", r: 2, key: "i" });
    const { el } = await draw([ref, ...logos.map((d) => dot(d.data, d.options))], [logos]);
    const where = new Map(circles(el, "ref").map((c) => [c.key.split(":").at(-1), [c.cx, c.cy]]));
    expect(where.size).toBe(4);
    const svg = el.querySelector("svg.ts-chart") as SVGSVGElement;
    const seen: string[] = [];
    for (const d of logos) {
      const got = circles(el, d.options.id);
      expect(got).toHaveLength(d.data.length);
      got.forEach((c, k) => {
        const row = d.data[k];
        // the dot's key ends with the row's index, which is the reference dot's key
        expect(c.key.endsWith(`:${row?.sdv_key}`)).toBe(true);
        expect([c.cx, c.cy]).toEqual(where.get(row?.sdv_key));
        expect(c.r).toBeCloseTo(14 * Math.SQRT2, 1);
        // the fill names a pattern in this svg, scoped by the chart's idPrefix, whose image is the team's logo
        expect(c.fill).toBe(`url(#t1-${d.options.id})`);
        const image = svg.querySelector(`pattern[id="t1-${d.options.id}"] > image`);
        expect(image?.getAttribute("href")).toBe(logoUrlSync(row?.team as string, "nfl"));
        seen.push(row?.sdv_id as string);
      });
    }
    expect(seen.sort()).toEqual(["KC", "LAC", "DEN", "LV"].map(ID).sort());
  },
);

test("an update keeps the dots on their rows and the patterns in step: moved, added and removed teams", async () => {
  const before = WEST.slice(0, 2).map((r, i) => ({ ...r, i }));
  const a = logoDots(before, { x: "pf", y: "pa", team: "team", league: "nfl" });
  const { el, update } = await draw(
    a.map((d) => dot(d.data, d.options)),
    [a],
  );
  expect(el.querySelectorAll("pattern")).toHaveLength(2);
  // KC moves, LAC leaves, LV arrives: TanStack reconciles the keyed svg in place
  const after = [
    { ...WEST[0], pf: 300, pa: 300, i: 0 },
    { ...WEST[3], i: 1 },
  ];
  const b = logoDots(after, { x: "pf", y: "pa", team: "team", league: "nfl" });
  const ref = dot(after, { id: "ref", x: "pf", y: "pa", r: 2, key: "i" });
  await update([ref, ...b.map((d) => dot(d.data, d.options))], b);
  const where = new Map(circles(el, "ref").map((c) => [c.key.split(":").at(-1), [c.cx, c.cy]]));
  for (const d of b) {
    const [c] = circles(el, d.options.id);
    expect([c?.cx, c?.cy]).toEqual(where.get(d.data[0]?.sdv_key));
    expect(el.querySelector(`pattern[id="t1-${d.options.id}"] > image`)?.getAttribute("href")).toBe(
      d.pattern.href,
    );
  }
  expect(
    [...el.querySelectorAll("pattern")].map((p) => p.querySelector("image")?.getAttribute("href")),
  ).toEqual(b.map((d) => d.pattern.href));
  expect(el.querySelectorAll(`g[data-ts-key="${a[1]?.options.id}"]`)).toHaveLength(0); // LAC's dot is gone
});

test("the SVG export (serializeChartSvg) carries the patterns and the dots' fills", async () => {
  const logos = logoDots(WEST, { x: "pf", y: "pa", team: "team", league: "nfl" });
  const { el } = await draw(
    logos.map((d) => dot(d.data, d.options)),
    [logos],
  );
  // parsed back as a page would read the exported file
  const exported = document.createElement("template");
  exported.innerHTML = serializeChartSvg(el);
  expect(exported.content.querySelectorAll("circle")).toHaveLength(4);
  for (const d of logos) {
    expect(exported.content.querySelector(`circle[fill="url(#t1-${d.options.id})"]`)).not.toBeNull();
    expect(
      exported.content.querySelector(`pattern[id="t1-${d.options.id}"] image`)?.getAttribute("href"),
    ).toBe(d.pattern.href);
  }
});

test("a team with no logo draws no dot, and warns once, beside the teams that have one", async () => {
  const warned: string[] = [];
  setWarningHandler((m) => void warned.push(String(m)));
  try {
    const rows = [...WEST, { team: "XXX", pf: 350, pa: 350 }];
    const logos = logoDots(rows, { x: "pf", y: "pa", team: "team", league: "nfl" });
    const { el } = await draw(
      logos.map((d) => dot(d.data, d.options)),
      [logos],
    );
    expect(el.querySelectorAll("circle")).toHaveLength(4);
    expect(el.querySelectorAll("pattern")).toHaveLength(4);
    expect(warned).toHaveLength(1);
  } finally {
    setWarningHandler(null);
  }
});

test("teamColorScale colours each team's line by its value as the data holds it: numeric ids in another order", async () => {
  // ESPN ids, rows in the reverse of the scale's order: TanStack maps by value, not by position in the data
  const rows = WEST.flatMap((t, k) => [
    { espn: t.espn, x: 1, y: k },
    { espn: t.espn, x: 2, y: k + 0.5 },
  ]).reverse();
  const teams = WEST.map((t) => t.espn);
  const color = teamColorScale("nfl", teams);
  // what each team should get, from the abbreviations: independent of the ids and of the scale itself
  const want = teamColorPalette(
    "nfl",
    WEST.map((t) => t.team),
  );
  const { el } = await draw([lineY(rows, { id: "line", x: "x", y: "y", z: "espn" })], [], { color });
  for (const [k, id] of teams.entries()) {
    // TanStack keys each series by its value's type and value: "line:number:12"
    const path = el.querySelector(`g[data-ts-key="line:number:${id}"] path`);
    expect(path?.getAttribute("stroke"), `ESPN id ${id}`).toBe(want[k]);
  }
  expect(new Set(want).size).toBe(4);
});
