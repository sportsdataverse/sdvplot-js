// @vitest-environment jsdom
// Phase 11 (J39, J40): the shot marks draw the CALLER's cells and areas, pass Plot's options through, and tip.
import * as Plot from "@observablehq/plot";
import { basketballZones } from "@sportsdataverse/sporty";
import { beforeAll, expect, test } from "vitest";
import { shootingSignature, shotCells, shotZones, surface } from "../../src/plot/index.js";
import {
  type CellVsLeague,
  cellsVsLeague,
  fgPctByDistance,
  signaturePoints,
  sizeCells,
  statsByZone,
  vsLeague,
} from "../../src/shots/index.js";
import { BKN, LEAGUE } from "../shots/fixture.js";
import { pointAt, stubBBox, tipText } from "./_pointer.js";

beforeAll(stubBBox);
const px = (fig: ReturnType<typeof Plot.plot>, name: "x" | "y", v: number): number =>
  fig.scale(name)?.apply(v) as number;

test("shotCells tip: the rim hex shows 181 attempts, 81.2%, league 76.3% and the shrunk +4.3%", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [...court.marks, shotCells(cells, { r: sizeCells(cells, { radius: 15 }).r, tip: true })],
  });
  pointAt(fig, px(fig, "x", -41.75), px(fig, "y", 0)); // the hoop, nba-legacy frame
  expect(tipText(fig)).toMatch(
    /Attempts\s*181.*FG%\s*81\.2%.*League FG%\s*76\.3%.*vs league \(shrunk\)\s*\+4\.3%/,
  );
  expect((fig as unknown as { value: CellVsLeague }).value).toMatchObject({ x: 0, y: 0, attempts: 181 });
});

test("shotZones tip with statsByZone: the restricted area reads 358/527, 67.9%; each path is named", () => {
  const fig = Plot.plot({
    width: 500,
    height: 500,
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#ddd",
      stats: statsByZone(BKN),
      tip: true,
    }),
  });
  pointAt(fig, px(fig, "x", -41.5), px(fig, "y", 0.3));
  expect(tipText(fig)).toMatch(/Zone\s*Restricted area.*Made\s*358\/527.*FG%\s*67\.9%/);
  expect(fig.querySelector('path[data-sdv-id="paint"]')?.getAttribute("aria-label")).toBe("Paint (non-RA)");
});

test("shootingSignature tip follows x: distance, FG%, league FG% and share at the pointer", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const fig = Plot.plot({ width: 640, y: { domain: [0, 1] }, marks: shootingSignature(pts, { tip: true }) });
  pointAt(fig, px(fig, "x", 12.3), px(fig, "y", 0.5));
  expect(tipText(fig)).toMatch(
    /Distance\s*12\.25 ft.*FG%\s*46\.8%.*League FG%\s*46\.0%.*Share of shots\s*1\.2%/,
  );
});

test("the cells are the mark's data: mark-level fx facets two halves of the season's shots", () => {
  const half = (rows: typeof BKN, label: string) =>
    cellsVsLeague(rows, LEAGUE.hex15).map((c) => ({ ...c, half: label }));
  const both = [...half(BKN.slice(0, 1000), "first 1000"), ...half(BKN.slice(1000), "last 1000")];
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 900,
    marks: [...court.marks, shotCells(both, { r: 15, fx: "half" })],
  });
  expect(
    fig.querySelectorAll("g[aria-label='fx-axis tick label'] text, g[aria-label='fx-axis tick label']")
      .length,
  ).toBeGreaterThan(0);
  expect(fig.querySelectorAll("path[data-sdv-id]")).toHaveLength(both.length);
});

test("dropOutside: a tip never points at a dropped (off-frame) cell; Plot's own clip passes through", () => {
  // The real 2026 league hex15 index drawn as a player: 28 of its 397 centres lie past half court.
  const cells: CellVsLeague[] = LEAGUE.hex15.cells.map((c) => ({
    ...c,
    makes: Math.round((c.fgPct ?? 0) * c.attempts),
    meanDistance: Math.hypot(c.x, c.y) / 10,
    zone: "above_break_3",
    leagueFgPct: c.fgPct,
  }));
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 700,
    marks: [...court.marks, shotCells(cells, { r: 15, tip: true, clip: "frame" })],
  });
  // the dropped cell nearest the frame: smallest legacy y past 417.5, then nearest the centre line
  const back = cells.filter((c) => c.y > 417.5).sort((a, b) => a.y - b.y || Math.abs(a.x) - Math.abs(b.x))[0];
  expect(back).toMatchObject({ y: 427.5 });
  pointAt(fig, px(fig, "x", -47 + 5.25 + (back?.y ?? 0) / 10), px(fig, "y", (back?.x ?? 0) / 10));
  const v = (fig as unknown as { value: CellVsLeague | null }).value;
  expect(v === null || v.y <= 417.5).toBe(true); // with the filter in render instead, this focused (12.99, 427.5)
  expect(fig.outerHTML).toMatch(/clip-path="url\(#plot-clip-\d+\)"/);
});

test("a caller's sort replaces the default fewest-attempts-first order", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [
      ...court.marks,
      shotCells(cells, { r: 15, sort: (a: CellVsLeague, b: CellVsLeague) => b.attempts - a.attempts }),
    ],
  });
  expect(fig.querySelectorAll("path[data-sdv-id]")[0]?.getAttribute("data-sdv-id")).toBe("0,0"); // busiest first
});

test("shotCells composes a caller's render (outermost), initializer (after the frame drop) and tip format", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const busy = cells.filter((c) => c.attempts >= 20).length;
  const seen: number[] = [];
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [
      ...court.marks,
      shotCells(cells, {
        r: 15,
        tip: { format: { diff: "+.2%" } }, // a tip options object keeps its own formats
        render: (index, scales, values, dimensions, context, next) => {
          const g = next?.(index, scales, values, dimensions, context) ?? null;
          seen.push(g?.querySelectorAll("path[data-sdv-id]").length ?? -1); // sdvplot's stamps are inside
          return g;
        },
        initializer: (data, facets) => ({
          data,
          facets: facets.map((I) => I.filter((i) => (data[i] as CellVsLeague).attempts >= 20)),
        }),
      }),
    ],
  });
  expect(fig.querySelectorAll("path[data-sdv-id]")).toHaveLength(busy);
  expect(seen).toEqual([busy]);
  pointAt(fig, px(fig, "x", -41.75), px(fig, "y", 0));
  expect(tipText(fig)).toMatch(/vs league \(shrunk\)\s*\+4\.\d\d%/);
});

test("shotZones labels are aria-hidden (the paths carry the names); a signature TipOptions overrides its formats", () => {
  const z = statsByZone(BKN);
  const zones = Plot.plot({
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#ddd",
      text: (k) => `${z[k].makes}/${z[k].attempts}`,
    }),
  });
  expect(zones.querySelector("g[aria-label=text]")?.getAttribute("aria-hidden")).toBe("true");
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const fig = Plot.plot({
    width: 640,
    y: { domain: [0, 1] },
    marks: shootingSignature(pts, { tip: { format: { x: (d: number) => `${d} feet`, y: ".0%" } } }),
  });
  pointAt(fig, px(fig, "x", 12.3), px(fig, "y", 0.5));
  expect(tipText(fig)).toMatch(/Distance\s*12\.25 feet.*FG%\s*47%/);
});
