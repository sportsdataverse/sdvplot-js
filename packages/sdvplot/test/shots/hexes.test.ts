// @vitest-environment node
import { BASKETBALL_ZONES, type BasketballZone } from "@sportsdataverse/sporty";
import { expect, test } from "vitest";
import RAW_SQUARE from "../../../../fixtures/shots/nba-2026-league-square.json" with { type: "json" };
import RAW_LEAGUE from "../../../../fixtures/shots/nba-2026-league.json" with { type: "json" };
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
import { shotZone } from "../../src/shots/aggregate.js";
import {
  type LeagueCell,
  type LeagueIndex,
  binner,
  cellsVsLeague,
  leagueIndex,
  shrunkDiff,
  sizeCells,
  squarebin,
  statsByZone,
} from "../../src/shots/index.js";
import { BKN, LEAGUE, LEAGUE_SQUARE } from "./fixture.js";

test("fixture sanity: 2000 shots, 890 made, 968 threes, 1998 within 35 ft", () => {
  expect(BKN.length).toBe(2000);
  expect(BKN.filter((s) => s.shot_result === "Made").length).toBe(890);
  expect(BKN.filter((s) => s.shot_value === 3).length).toBe(968);
  expect(BKN.filter((s) => s.shot_distance <= 35).length).toBe(1998);
});
test("zones: every shot in main's zone; statsByZone equal", () => {
  expect(BKN.map((s) => BASKETBALL_ZONES.indexOf(shotZone(s))).join("")).toBe(ORACLE.main.zoneOf);
  expect(statsByZone(BKN)).toEqual(ORACLE.main.zones);
});
test("cellsVsLeague at r = 10 and r = 15 equal main's bin for bin: centre, counts, mean distance, zone, league rate", () => {
  expect(cellsVsLeague(BKN, LEAGUE.hex10)).toEqual(ORACLE.main.hex10);
  expect(cellsVsLeague(BKN, LEAGUE.hex15)).toEqual(ORACLE.main.hex15);
  expect(ORACLE.main.hex10).toHaveLength(374);
  expect(ORACLE.main.hex15).toHaveLength(211);
});
test("a hex the league shot from fewer than 25 times takes its zone's league rate (16 of the 374 1 ft hexes)", () => {
  const thin = ORACLE.main.hex10.filter((h) => {
    const l = LEAGUE.hex10.cells.find((x) => x.x === h.x && x.y === h.y);
    return !(l && l.attempts >= 25);
  });
  expect(thin).toHaveLength(16);
  for (const h of thin) expect(h.leagueFgPct).toBe(LEAGUE.hex10.zones[h.zone as BasketballZone].fgPct);
  expect(leagueIndex(BKN, 15).zones).toEqual(ORACLE.main.zones);
});
test("sizeCells: main's sqrt-p95 caps (17 at r = 10, 30 at r = 15); master's linear cap hides singletons", () => {
  expect(sizeCells(ORACLE.main.hex10, { radius: 10 }).cap).toBe(ORACLE.main.cap10);
  expect(sizeCells(ORACLE.main.hex15, { radius: 15 }).cap).toBe(ORACLE.main.cap15);
  expect([ORACLE.main.cap10, ORACLE.main.cap15]).toEqual([17, 30]);
  const s = sizeCells(ORACLE.main.hex15, { radius: 15 });
  expect([s.size(30), s.size(181)]).toEqual([15, 15]);
  expect(s.steps).toEqual([1, 15, 30]);
  const m = sizeCells(ORACLE.main.hex10, { radius: 10, rule: "linear-cap" });
  expect(m.r.filter((r) => r === 0)).toHaveLength(129); // the single-attempt hexes (Hexagon/index.js:26-28)
  expect(Math.max(...m.r)).toBe(10);
});
test("shrunkDiff: (m + kL)/(a + k) - L; k = 0 is the raw difference", () => {
  expect(shrunkDiff(1, 1, 0.5)).toBeCloseTo((1 + 12.5) / 26 - 0.5, 12);
  expect(shrunkDiff(20, 20, 0.5)).toBeCloseTo((20 + 12.5) / 45 - 0.5, 12);
  expect(shrunkDiff(93, 116, 0.74976, 0)).toBeCloseTo(93 / 116 - 0.74976, 12);
});

const X = (s: (typeof BKN)[number]): number => s.x_legacy;
const Y = (s: (typeof BKN)[number]): number => s.y_legacy;

test("square index (J38): leagueIndex stores the resolved lattice; squarebin's cells; sizes on the side", () => {
  const index = leagueIndex(BKN, { shape: "square", side: 15 });
  expect(index).toMatchObject({ shape: "square", side: 15 });
  expect(index).not.toHaveProperty("radius");
  expect(index.zones).toEqual(ORACLE.main.zones); // zone rates do not depend on the lattice
  const eq = leagueIndex(BKN, { shape: "square", radius: 15, equalArea: true });
  expect(eq).toMatchObject({
    shape: "square",
    side: binner({ shape: "square", radius: 15, equalArea: true }).size,
  });
  expect(eq).not.toHaveProperty("radius");
  expect(eq).not.toHaveProperty("equalArea");
  const cells = cellsVsLeague(BKN, index);
  const bins = squarebin(BKN, { side: 15, x: X, y: Y }); // 0 off-court shots
  expect(cells.map((c) => [c.x, c.y, c.attempts])).toEqual(bins.map((b) => [b.x, b.y, b.length]));
  expect(cells).toHaveLength(395);
  // Only the full size enters the size rule: squares of side 15 size exactly like hexagons of radius 15.
  expect(sizeCells(cells, index)).toMatchObject({ cap: 15, steps: [1, 8, 15] });
  expect(sizeCells(cells, index).r).toEqual(sizeCells(cells, { radius: 15 }).r);
  expect(sizeCells(cells, { ...index, rule: "linear-cap" }).r.filter((r) => r === 0)).toHaveLength(135);
  const e = sizeCells(cells, { shape: "square", radius: 15, equalArea: true });
  expect(e.size(e.cap)).toBeCloseTo(15 * Math.sqrt(1.5 * Math.sqrt(3)), 12);
});
test("square cells vs the real league (J38 S16): the SAME square's league rate at 25+ attempts, else its zone's", () => {
  const sq = binner({ shape: "square", radius: 10, equalArea: true });
  expect(LEAGUE_SQUARE).toMatchObject({ shape: "square", side: sq.size });
  expect(LEAGUE_SQUARE).not.toHaveProperty("radius");
  // Context data, not an oracle: the same 219,159 shots and makes as blazing-the-nets' hex10, and its zone rates.
  const totals = (i: LeagueIndex): number[] => [
    i.cells.reduce((t, h) => t + h.attempts, 0),
    i.cells.reduce((t, h) => t + Math.round((h.fgPct ?? 0) * h.attempts), 0),
  ];
  expect(totals(LEAGUE_SQUARE)).toEqual(totals(LEAGUE.hex10));
  expect(totals(LEAGUE_SQUARE)).toEqual([219159, 103227]);
  expect(LEAGUE_SQUARE.cells).toHaveLength(787);
  expect(LEAGUE_SQUARE.zones).toEqual(LEAGUE.hex10.zones);
  const cells = cellsVsLeague(BKN, LEAGUE_SQUARE);
  const bins = squarebin(BKN, { side: sq.size, x: X, y: Y });
  expect(cells.map((c) => [c.x, c.y, c.attempts])).toEqual(bins.map((b) => [b.x, b.y, b.length]));
  expect(cells).toHaveLength(378); // 374 hexagons of the same area
  const byKey = new Map(LEAGUE_SQUARE.cells.map((h) => [`${h.x},${h.y}`, h]));
  let fellBack = 0;
  for (const c of cells) {
    const l = byKey.get(`${c.x},${c.y}`);
    expect(l).toBeDefined(); // every BKN shot is a league shot, so every player square is a league square
    const own = l !== undefined && l.attempts >= 25;
    if (!own) fellBack += 1;
    expect(c.leagueFgPct).toBe(own ? l.fgPct : LEAGUE_SQUARE.zones[c.zone].fgPct);
  }
  expect(fellBack).toBe(17); // both branches run: 361 squares on their own league rate, 17 on their zone's
  const s = sizeCells(cells, LEAGUE_SQUARE);
  expect(s).toMatchObject({ cap: 16, steps: [1, 8, 16] });
  expect(s.r).toEqual(sizeCells(cells, { radius: sq.size }).r);
  expect(s.r).toEqual(sizeCells(cells, { shape: "square", radius: 10, equalArea: true }).r);
});
test("LeagueIndex names its cells `cells`; the committed fixtures keep blazing-the-nets' `hexes` and are remapped on load", () => {
  expect(Object.keys(leagueIndex(BKN, 15))).toEqual(["radius", "cells", "zones"]);
  expect(Object.keys(leagueIndex(BKN, { shape: "square", side: 15 }))).toEqual([
    "shape",
    "side",
    "cells",
    "zones",
  ]);
  // The tool output is byte-identical (fixtures/shots/README.md), so the raw JSON still says `hexes`.
  expect(Object.keys(RAW_LEAGUE.hex10)).toEqual(["radius", "hexes", "zones"]);
  expect(Object.keys(RAW_SQUARE.square10)).toEqual(["shape", "side", "hexes", "zones"]);
  for (const [index, raw] of [
    [LEAGUE.hex10, RAW_LEAGUE.hex10],
    [LEAGUE.hex15, RAW_LEAGUE.hex15],
    [LEAGUE_SQUARE, RAW_SQUARE.square10],
  ] as const) {
    expect(index).not.toHaveProperty("hexes");
    expect(index.cells).toBe(raw.hexes);
    expect(index.zones).toBe(raw.zones);
  }
});
test("a league cell with EXACTLY 25 attempts keeps its own rate: the fallback is `attempts >= minLeague` (aggregate.ts:163)", () => {
  // Real shots, no constructed rows: BKN's own r = 15 index has one cell of exactly 25 attempts (12 made).
  const index = leagueIndex(BKN, 15);
  const at25 = index.cells.filter((c) => c.attempts === 25);
  expect(at25).toHaveLength(1);
  const key = (c: { x: number; y: number }): string => `${c.x},${c.y}`;
  const of = (minLeague?: number) =>
    cellsVsLeague(BKN, index, minLeague).find((c) => key(c) === key(at25[0] as LeagueCell));
  const own = of();
  expect(own?.leagueFgPct).toBe(0.48);
  const zone = index.zones[own?.zone ?? "mid_range"].fgPct;
  expect(zone).not.toBe(0.48); // so the two branches are distinguishable
  expect(of(25)?.leagueFgPct).toBe(0.48);
  expect(of(26)?.leagueFgPct).toBe(zone);
});
test("sqrt-p95 rounds a fractional 95th percentile UP (hexShotChart.ts:71): the league's 397 r = 15 cells cap at 2254", () => {
  // d3-array's R-7 P95 of the real league cells is 2253.4, so Math.floor and Math.round would both give 2253.
  const s = sizeCells(LEAGUE.hex15.cells, LEAGUE.hex15);
  expect(LEAGUE.hex15.cells).toHaveLength(397);
  expect(s.cap).toBe(2254);
  expect(s.steps).toEqual([1, 1127, 2254]);
  expect(s.size(2254)).toBe(15);
  expect(s.size(2253)).toBeLessThan(15);
});
