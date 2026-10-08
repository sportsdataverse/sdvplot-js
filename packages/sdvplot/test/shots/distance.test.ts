// @vitest-environment node
import { expect, test } from "vitest";
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
import { InputError } from "../../src/errors.js";
import {
  cellsVsDistance,
  cellsVsLeague,
  fgPctByDistance,
  leagueIndex,
  signaturePoints,
  statsBySide,
  vsLeague,
} from "../../src/shots/index.js";
import { kernelSmooth, kernelSum } from "../../src/shots/signature.js";
import { BKN, LEAGUE } from "./fixture.js";

type MasterBin = { SHOT_MADE_FLAG: number; SHOT_ATTEMPTED_FLAG: number };
const pairs = (a: readonly MasterBin[]) => a.map((b) => [b.SHOT_MADE_FLAG, b.SHOT_ATTEMPTED_FLAG]);

test("distance bins and side bins equal main's (1 ft, 3 ft; centre 0 and 7.5)", () => {
  expect(fgPctByDistance(BKN)).toEqual(ORACLE.main.byFoot);
  expect(fgPctByDistance(BKN, 3)).toEqual(ORACLE.main.byBin3);
  expect(statsBySide(BKN)).toEqual(ORACLE.main.sides.c0);
  expect(statsBySide(BKN, 1, 35, 7.5)).toEqual(ORACLE.main.sides.c75);
  expect(statsBySide(BKN, 3)).toEqual(ORACLE.main.sides.bin3);
});
test("master parity: its 1 ft bins, its left/right that drops the 76 shots at x == 0, its ribbon share", () => {
  const foot = fgPctByDistance(BKN, 1, 35);
  expect(foot.map((b) => [b.makes, b.attempts])).toEqual(pairs(ORACLE.master.bin));
  const lr = statsBySide(BKN, 1, 35, false);
  expect(lr.map((b) => [b.left.makes, b.left.attempts])).toEqual(pairs(ORACLE.master.binLeftRight.left));
  expect(lr.map((b) => [b.right.makes, b.right.attempts])).toEqual(pairs(ORACLE.master.binLeftRight.right));
  expect(lr.reduce((s, b) => s + b.centre.attempts, 0)).toBe(0);
  expect(statsBySide(BKN).reduce((s, b) => s + b.centre.attempts, 0)).toBe(76);
  expect(foot.map((b) => b.share)).toEqual(ORACLE.master.ribbon.map((r) => r.width));
});
test("vsLeague refuses mismatched bins", () => {
  expect(() => vsLeague(fgPctByDistance(BKN, 3), LEAGUE.byFoot)).toThrow(/binFt/);
});
test("signaturePoints equal main's 141 samples (0.25 ft, kernel-smoothed); the ribbon ends at 30 ft", () => {
  const vs = vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot);
  expect(signaturePoints(vs)).toEqual(ORACLE.main.signature);
  expect(ORACLE.main.ribbonEnd).toBe(30);
  expect(ORACLE.main.signature.filter((p) => p.fgPct !== null)).toHaveLength(121);
  expect(
    kernelSum(
      vs.map((b) => b.attempts),
      0.9,
    ),
  ).toEqual(ORACLE.main.kernel.sum);
  expect(
    kernelSmooth(
      vs.map((b) => b.share),
      null,
      1,
    ),
  ).toEqual(ORACLE.main.kernel.smooth);
});
test("master signature: 1 ft samples, no smoothing, raw diff = per-bin FG% minus league", () => {
  const vs = vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot);
  const pts = signaturePoints(vs, { step: 1, smooth: false, minAttempts: 1, prior: 0 });
  expect(pts).toHaveLength(36);
  let checked = 0;
  for (const [i, p] of pts.entries()) {
    const b = vs[i];
    if (b === undefined || b.attempts === 0) continue;
    expect(p.fgPct).toBeCloseTo(b.fgPct ?? Number.NaN, 12);
    expect(p.colourDiff).toBeCloseTo(b.diff ?? Number.NaN, 12);
    checked += 1;
  }
  expect(checked).toBe(35); // one empty bin, where master drew 0% (ribbonShots.ts:14) and this draws a gap
});
test("master hex baseline: league FG% at floor(|centre| / 10) ft (Hexagon/index.js:44-49)", () => {
  const hexes = cellsVsDistance(BKN, LEAGUE.byFoot, 10);
  expect(hexes.map((h) => [h.x, h.y, h.attempts])).toEqual(
    ORACLE.main.hex10.map((h) => [h.x, h.y, h.attempts]),
  );
  const rim = hexes.find((h) => h.x === 0 && h.y === 0);
  expect(rim?.leagueFgPct).toBe(LEAGUE.byFoot[0]?.fgPct);
  expect(LEAGUE.byFoot[0]?.attempts).toBe(22335);
});
test("square cells (J38): master's distance baseline is read at each square's centre", () => {
  const cells = cellsVsDistance(BKN, LEAGUE.byFoot, { shape: "square", side: 10 });
  expect(cells).toHaveLength(641);
  for (const c of cells) {
    const d = Math.floor(Math.hypot(c.x, c.y) / 10);
    expect(c.leagueFgPct).toBe(LEAGUE.byFoot[d]?.fgPct ?? LEAGUE.byFoot[d - 1]?.fgPct ?? null);
  }
  // two centres 37+ ft out: past the 0-35 ft table and its one-foot fallback, as for hexes
  expect(cells.filter((c) => c.leagueFgPct === null)).toHaveLength(2);
  const sq = cellsVsLeague(BKN, leagueIndex(BKN, { shape: "square", side: 10 }));
  expect(cells.map((c) => [c.x, c.y, c.attempts])).toEqual(sq.map((c) => [c.x, c.y, c.attempts]));
});
test("master hex baseline falls back one foot over an empty bin: BKN against its own distance curve", () => {
  // BKN's own curve (= main's byFoot in the oracle): one 33-ft attempt, missed, and no 34-ft attempt at all.
  const own = fgPctByDistance(BKN);
  expect(own.slice(33, 35).map((b) => [b.distance, b.attempts, b.fgPct])).toEqual([
    [33, 1, 0],
    [34, 0, null],
  ]);
  // two radius-15 cells are centred 34.07 ft out; each takes bin 33's 0/1, not bin 34's null
  const at34 = cellsVsDistance(BKN, own, 15).filter((h) => Math.floor(Math.hypot(h.x, h.y) / 10) === 34);
  expect(at34.map((h) => [h.y, h.attempts, h.leagueFgPct])).toEqual([
    [270, 1, 0],
    [315, 1, 0],
  ]);
});
test("the one-foot fallback reads the bin BELOW (d - 1), not above: BKN's first 100 shots against their own curve", () => {
  // A real slice where the empty bin's two neighbours differ: 22 ft 0/1, 23 ft empty, 24 ft 5/10.
  const first100 = BKN.slice(0, 100);
  const own = fgPctByDistance(first100);
  expect(own.slice(22, 25).map((b) => [b.distance, b.attempts, b.makes, b.fgPct])).toEqual([
    [22, 1, 0, 0],
    [23, 0, 0, null],
    [24, 10, 5, 0.5],
  ]);
  // five radius-10 cells are centred 23.x ft out; each takes bin 22's 0 (bin 24 would give 0.5, no fallback null)
  const at23 = cellsVsDistance(first100, own, 10).filter((h) => Math.floor(Math.hypot(h.x, h.y) / 10) === 23);
  expect(at23).toHaveLength(5);
  expect(at23.map((h) => h.leagueFgPct)).toEqual([0, 0, 0, 0, 0]);
});
test("fgPctByDistance and statsBySide reject a binFt or maxFt that is not a finite number > 0", () => {
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    for (const f of [fgPctByDistance, statsBySide]) {
      expect(() => f(BKN, bad)).toThrow(InputError);
      expect(() => f(BKN, 1, bad)).toThrow(InputError);
    }
  }
  expect(() => fgPctByDistance(BKN, 0)).toThrow("binFt must be a finite number > 0, got 0");
  expect(() => statsBySide(BKN, 1, -1)).toThrow("maxFt must be a finite number > 0, got -1");
});
