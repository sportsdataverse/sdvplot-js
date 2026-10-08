// @vitest-environment node
import { expect, test } from "vitest";
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
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
