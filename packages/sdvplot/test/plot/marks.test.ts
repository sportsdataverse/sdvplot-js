// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { InputError, loadLeague, placeSync } from "../../src/index.js";
import { headshots, logos, wordmarks } from "../../src/plot/index.js";
import { drawnMarks } from "../../src/testing/index.js";

const rows = [
  { epa: 10, sr: -3, team: "LV" },
  { epa: 20, sr: -7, team: "LAR" },
];
const base = {
  height: 400,
  marginTop: 20,
  marginBottom: 30,
  x: { domain: [0, 30] },
  y: { domain: [-10, 0] },
} as const;
const o = { league: "nfl", x: "epa", y: "sr", team: "team" } as const;
beforeAll(() => loadLeague("nfl"));

test("logos draws each team at its own x/y at 0.1 of the frame height, with the archive url", () => {
  const svg = Plot.plot({ ...base, marks: [logos(rows, { ...o, height: 0.1 })] });
  const m = drawnMarks(svg);
  expect(m.map((d) => [d.x, d.y])).toEqual([
    [10, -3],
    [20, -7],
  ]);
  expect(m.every((d) => Math.abs(d.height - 0.1) / 0.1 < 0.01)).toBe(true);
  const img = svg.querySelector("image") as Element;
  expect(Number(img.getAttribute("height"))).toBeCloseTo(0.1 * (400 - 20 - 30), 6);
  expect(img.getAttribute("href")).toMatch(/^https:\/\/sdv\.nyc3\.cdn\.digitaloceanspaces\.com\//);
  expect(svg.outerHTML).not.toMatch(/NaN/);
});
test("width follows the mark's aspect ratio and the image stays centred on the point", () => {
  const svg = Plot.plot({ ...base, width: 640, marks: [logos(rows, { ...o, height: 0.2 })] });
  const img = svg.querySelector("image") as Element;
  const h = Number(img.getAttribute("height"));
  const w = Number(img.getAttribute("width"));
  expect(w / h).toBeGreaterThan(0.5);
  expect(w / h).toBeLessThan(2.5);
  const cx = Number(img.getAttribute("x")) + w / 2;
  const xScale = Plot.plot({ ...base, width: 640, marks: [Plot.dot(rows, { x: "epa", y: "sr" })] }).scale(
    "x",
  ) as { apply(v: number): number };
  expect(cx).toBeCloseTo(xScale.apply(10), 3);
});
test("height outside (0, 1] throws at construction, not at render", () => {
  expect(() => logos(rows, { ...o, height: 40 })).toThrow(InputError);
  expect(() => logos(rows, { ...o, alpha: 2 })).toThrow(InputError);
});
test("facets: height is a fraction of the facet frame", () => {
  const faceted = rows.map((r, i) => ({ ...r, f: i }));
  const svg = Plot.plot({
    height: 500,
    marginTop: 20,
    marginBottom: 30,
    facet: { data: faceted, y: "f" },
    fy: { domain: [0, 1] },
    x: { domain: [0, 30] },
    y: { domain: [-10, 0] },
    marks: [logos(faceted, { ...o, height: 0.5 })],
  });
  const hs = Array.from(svg.querySelectorAll("image")).map((i) => Number(i.getAttribute("height")));
  expect(hs).toHaveLength(2);
  expect(hs[0]).toBeLessThan(0.5 * (500 - 50));
  expect(hs[0]).toBeCloseTo(hs[1] as number, 6);
  const dm = drawnMarks(svg);
  expect(dm).toHaveLength(2);
  expect(dm.every((d) => Math.abs(d.height - 0.5) / 0.5 < 0.01)).toBe(true);
});
test("a null y row is skipped and nothing NaN is written", () => {
  const svg = Plot.plot({
    ...base,
    marks: [logos([{ epa: 10, sr: null, team: "LV" }, rows[1] as (typeof rows)[number]], o)],
  });
  expect(drawnMarks(svg)).toHaveLength(1);
  expect(svg.outerHTML).not.toMatch(/NaN/);
});
test("duplicate points and skipped rows keep titles and ids aligned by row", () => {
  const data = [
    { epa: 10, sr: -3, team: "LV", t: "a" },
    { epa: 10, sr: -3, team: "XXX", t: "skipped" },
    { epa: 10, sr: -3, team: "LAR", t: "c" },
  ];
  const svg = Plot.plot({ ...base, marks: [logos(data, { ...o, title: "t" })] });
  expect(Array.from(svg.querySelectorAll("image title")).map((t) => t.textContent)).toEqual(["a", "c"]);
  const ids = placeSync([10, 10], [-3, -3], ["LV", "LAR"], { league: "nfl" }).map((p) => p.id);
  expect(ids[0]).not.toBe(ids[1]);
  expect(drawnMarks(svg).map((d) => d.id)).toEqual(ids);
});
test("season: a column name is a channel, a 4-digit string is the literal year", () => {
  const data = [
    { epa: 10, sr: -3, team: "LV", yr: 2019 },
    { epa: 20, sr: -7, team: "LV", yr: 2023 },
  ];
  const col = drawnMarks(Plot.plot({ ...base, marks: [logos(data, { ...o, season: "yr" })] }));
  expect(col.map((d) => d.x)).toEqual([10, 20]);
  const lit = drawnMarks(Plot.plot({ ...base, marks: [logos(data, { ...o, season: "2023" })] }));
  const want = placeSync([10, 20], [-3, -7], ["LV", "LV"], { league: "nfl", season: 2023 });
  expect(lit.map((d) => d.url)).toEqual(want.map((p) => p.url));
});
test("wordmarks and headshots stamp their kind; headshots keep 600:436", () => {
  const svg = Plot.plot({
    ...base,
    marks: [
      wordmarks(rows, o),
      headshots([{ epa: 5, sr: -5, pid: "3139477" }], { league: "nfl", x: "epa", y: "sr", player: "pid" }),
    ],
  });
  const m = drawnMarks(svg);
  expect(m.map((d) => d.kind)).toEqual(["wordmark", "wordmark", "headshot"]);
  const hs = svg.querySelectorAll("image")[2] as Element;
  expect(Number(hs.getAttribute("width")) / Number(hs.getAttribute("height"))).toBeCloseTo(600 / 436, 4);
});
test("a mark built before the league is loaded throws InputError", () => {
  expect(() => logos(rows, { ...o, league: "mlb" })).toThrow(/not loaded/);
});
