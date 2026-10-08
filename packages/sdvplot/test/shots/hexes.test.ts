// @vitest-environment node
import { BASKETBALL_ZONES, type BasketballZone } from "@sportsdataverse/sporty";
import { expect, test } from "vitest";
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
import { shotZone } from "../../src/shots/aggregate.js";
import {
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
    const l = LEAGUE.hex10.hexes.find((x) => x.x === h.x && x.y === h.y);
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
    i.hexes.reduce((t, h) => t + h.attempts, 0),
    i.hexes.reduce((t, h) => t + Math.round((h.fgPct ?? 0) * h.attempts), 0),
  ];
  expect(totals(LEAGUE_SQUARE)).toEqual(totals(LEAGUE.hex10));
  expect(totals(LEAGUE_SQUARE)).toEqual([219159, 103227]);
  expect(LEAGUE_SQUARE.hexes).toHaveLength(787);
  expect(LEAGUE_SQUARE.zones).toEqual(LEAGUE.hex10.zones);
  const cells = cellsVsLeague(BKN, LEAGUE_SQUARE);
  const bins = squarebin(BKN, { side: sq.size, x: X, y: Y });
  expect(cells.map((c) => [c.x, c.y, c.attempts])).toEqual(bins.map((b) => [b.x, b.y, b.length]));
  expect(cells).toHaveLength(378); // 374 hexagons of the same area
  const byKey = new Map(LEAGUE_SQUARE.hexes.map((h) => [`${h.x},${h.y}`, h]));
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
