// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { basketballZones } from "@sportsdataverse/sporty";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { shootingSignature, shotCells, shotZones, surface } from "../../src/plot/index.js";
import {
  cellsVsLeague,
  diffScale,
  fgPctByDistance,
  leagueIndex,
  shrunkDiff,
  signaturePoints,
  sizeCells,
  statsByZone,
  vsLeague,
} from "../../src/shots/index.js";
import { BKN, LEAGUE } from "../shots/fixture.js";

// Plot reports a warning on the console and as a ⚠️ badge on the figure; the docs gate rejects both.
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn");
});
afterEach(() => {
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

/** The paths of the last geo mark on a figure (the court's own geo marks come first). */
const lastGeoPaths = (fig: Element): Element[] => {
  const geos = fig.querySelectorAll("g[aria-label=geo]");
  return [...(geos[geos.length - 1]?.querySelectorAll("path") ?? [])];
};

test("shotCells: one data-space hexagon per visible hex, on the court, id-stamped, coloured by shrunk diff", () => {
  const hexes = cellsVsLeague(BKN, LEAGUE.hex15);
  const { r } = sizeCells(hexes, { radius: 15 });
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({ ...court.scales, width: 500, marks: [...court.marks, shotCells(hexes, { r })] });
  const paths = lastGeoPaths(fig);
  expect(paths).toHaveLength(211); // every hex has at least one attempt, so none is hidden
  const rim = fig.querySelector('path[data-sdv-id="0,0"]'); // 181 attempts, the biggest, drawn last
  expect(rim).toBe(paths[paths.length - 1]);
  const h = hexes.find((x) => x.x === 0 && x.y === 0);
  expect(h?.attempts).toBe(181);
  expect(rim?.getAttribute("fill")).toBe(
    diffScale()(shrunkDiff(h?.makes ?? 0, h?.attempts ?? 0, h?.leagueFgPct ?? 0)),
  );
});

test("shotCells honours the frame: nba-legacy-vertical puts the rim hex at the bottom centre", () => {
  const hexes = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense", rotation: 90 });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [shotCells(hexes, { r: 15, frame: "nba-legacy-vertical" })],
  });
  const x = fig.scale("x");
  const y = fig.scale("y");
  const [r0, r1] = [...(x?.range ?? [])] as number[];
  expect(x?.apply(0)).toBeCloseTo(((r0 ?? 0) + (r1 ?? 0)) / 2, 6);
  expect(y?.apply(-41.75)).toBeGreaterThan(y?.apply(-20) ?? 0); // y grows down in pixels: the hoop is lower
  // The rim hex's own outline sits around that bottom-centre hoop: its six vertices average to (x(0), y(-41.75)).
  const d = fig.querySelector('path[data-sdv-id="0,0"]')?.getAttribute("d") ?? "";
  const pts = [...d.matchAll(/[ML]([-\d.e]+),([-\d.e]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  expect(pts).toHaveLength(6);
  const mean = (k: 0 | 1) => pts.reduce((s, p) => s + (p[k] ?? 0), 0) / pts.length;
  expect(mean(0)).toBeCloseTo(x?.apply(0) ?? Number.NaN, 1);
  expect(mean(1)).toBeCloseTo(y?.apply(-41.75) ?? Number.NaN, 1);
});

test("shotZones: six zone areas with zone ids and six haloed labels", () => {
  const z = statsByZone(BKN);
  const fig = Plot.plot({
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#dddddd",
      text: (k) => `${z[k].makes}/${z[k].attempts}`,
    }),
  });
  expect([...fig.querySelectorAll("path[data-sdv-id]")].map((p) => p.getAttribute("data-sdv-id"))).toEqual([
    "restricted_area",
    "paint",
    "mid_range",
    "corner_3_left",
    "corner_3_right",
    "above_break_3",
  ]);
  const labels = [...fig.querySelectorAll("g[aria-label=text] text")];
  expect(labels).toHaveLength(6);
  expect(labels.map((t) => t.textContent)).toContain("358/527");
  const g = fig.querySelector("g[aria-label=text]");
  expect(g?.getAttribute("paint-order")).toBe("stroke");
  expect(g?.getAttribute("stroke-width")).toBe("3");
  // the corner strips' labels run vertically
  expect(labels.filter((t) => /rotate\(-90\)/.test(t.getAttribute("transform") ?? ""))).toHaveLength(2);
});

test("shootingSignature: content-hash gradient ids, equal for equal input, distinct otherwise; 61 stops", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const a = Plot.plot({ y: { domain: [0, 1] }, marks: shootingSignature(pts) });
  const b = Plot.plot({ y: { domain: [0, 1] }, marks: shootingSignature(pts) });
  const c = Plot.plot({
    y: { domain: [0, 1] },
    marks: shootingSignature(pts, { fill: diffScale({ theme: "dark" }) }),
  });
  const id = (f: Element) => f.querySelector("linearGradient")?.getAttribute("id");
  expect(id(a)).toMatch(/^sdv-signature-[0-9a-z]+$/);
  expect(id(a)).toBe(id(b));
  expect(id(a)).not.toBe(id(c));
  expect(a.querySelectorAll("linearGradient stop")).toHaveLength(61); // 121 drawn samples, every other one
  expect(a.querySelector(`[fill="url(#${id(a)})"]`)).not.toBeNull(); // Plot puts a constant fill on the mark's <g>
});

test("shotCells shape 'square' (J38): four-corner data-space squares, id-stamped and coloured like hexes", () => {
  const index = leagueIndex(BKN, { shape: "square", side: 15 });
  const cells = cellsVsLeague(BKN, index);
  const court = surface("nba", { displayRange: "defense" });
  const draw = (shape: "hex" | "square") =>
    Plot.plot({
      ...court.scales,
      width: 500,
      marks: [...court.marks, shotCells(cells, { r: sizeCells(cells, index).r, shape })],
    });
  const fig = draw("square");
  const paths = lastGeoPaths(fig);
  expect(paths).toHaveLength(395);
  const corners = (p: Element) => p.getAttribute("d")?.match(/[ML]/g)?.length;
  expect(new Set(paths.map(corners))).toEqual(new Set([4]));
  const hexPaths = lastGeoPaths(draw("hex"));
  expect(new Set(hexPaths.map(corners))).toEqual(new Set([6])); // same cells, same order, only the outline differs
  expect(hexPaths.map((p) => p.getAttribute("data-sdv-id"))).toEqual(
    paths.map((p) => p.getAttribute("data-sdv-id")),
  );
  const rim = fig.querySelector('path[data-sdv-id="0,0"]'); // 115 attempts, the busiest square, drawn last
  expect(rim).toBe(paths[paths.length - 1]);
  const h = cells.find((c) => c.x === 0 && c.y === 0);
  expect(h?.attempts).toBe(115);
  expect(rim?.getAttribute("fill")).toBe(
    diffScale()(shrunkDiff(h?.makes ?? 0, h?.attempts ?? 0, h?.leagueFgPct ?? 0)),
  );
});
