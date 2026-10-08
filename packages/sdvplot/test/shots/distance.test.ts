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
import type { DistanceBin } from "../../src/shots/index.js";
import { kernelSmooth, kernelSum } from "../../src/shots/signature.js";
import { BKN, LEAGUE } from "./fixture.js";

type MasterBin = { SHOT_MADE_FLAG: number; SHOT_ATTEMPTED_FLAG: number };
/** Integer square root, exact for any safe integer: the expected feet below never go through the port's float formula. */
const isqrt = (n: number): number => {
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r -= 1;
  while ((r + 1) * (r + 1) <= n) r += 1;
  return r;
};
/** The league FG% a cell `foot` feet out reads, with master's one-foot fallback (Hexagon/index.js:44-49). */
const readFoot = (byFoot: readonly DistanceBin[], foot: number) =>
  byFoot[foot]?.fgPct ?? byFoot[foot - 1]?.fgPct ?? null;
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
  // a side-10 square centre is (10i, 10j) tenths of a foot, so its foot is isqrt(i² + j²), in integers
  for (const c of cells) {
    const [i, j] = [c.x / 10, c.y / 10];
    expect(Number.isInteger(i) && Number.isInteger(j)).toBe(true);
    expect(c.leagueFgPct).toBe(readFoot(LEAGUE.byFoot, isqrt(i * i + j * j)));
  }
  // by hand: (-30, 10) is √1000 tenths = 3.16 ft, foot 3; (-40, 250) is √64100 tenths = 25.3 ft, foot 25
  const at = (x: number, y: number) => cells.find((c) => c.x === x && c.y === y)?.leagueFgPct;
  expect(at(-30, 10)).toBe(LEAGUE.byFoot[3]?.fgPct);
  expect(at(-40, 250)).toBe(LEAGUE.byFoot[25]?.fgPct);
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
  // two radius-15 cells are centred 34.07 ft out, (8·15√3, 270) and (5·15√3, 315), both √116100 tenths; each takes
  // bin 33's 0/1, not bin 34's null. The centres are hard-coded, so the distance formula cannot pick them.
  const cells = cellsVsDistance(BKN, own, 15);
  const at34 = [
    [208, 270],
    [130, 315],
  ].map(([x, y]) => cells.find((h) => Math.round(h.x) === x && h.y === y));
  expect(at34.map((h) => [h?.y, h?.attempts, h?.leagueFgPct])).toEqual([
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
  // five radius-10 cells are centred 23.x ft out, hard-coded: (±27·5√3, -15) and (27·5√3, 15) at √54900 tenths,
  // (27·5√3, 45) and (-9·5√3, 225) at √56700. Each takes bin 22's 0 (bin 24 would give 0.5, no fallback null).
  const cells = cellsVsDistance(first100, own, 10);
  const at23 = [
    [234, -15],
    [234, 45],
    [-234, -15],
    [234, 15],
    [-78, 225],
  ].map(([x, y]) => cells.find((h) => Math.round(h.x) === x && h.y === y));
  expect(at23.map((h) => h?.leagueFgPct)).toEqual([0, 0, 0, 0, 0]);
});
test("S21: the radius-10 baseline reads master's foot on every cell but the 13 whole-foot centres sqrt reads short", () => {
  // Exact geometry, no float distance: a radius-10 hex centre is (m·5√3, 15j) tenths for integers m, j, so its
  // squared distance is 75m² + 225j², an integer, and its true foot is isqrt(floor(that / 100)).
  const cells = cellsVsDistance(BKN, LEAGUE.byFoot, 10);
  expect(cells).toHaveLength(374);
  const short: string[] = [];
  let whole = 0;
  for (const h of cells) {
    const [m, j] = [Math.round(h.x / (5 * Math.sqrt(3))), Math.round(h.y / 15)];
    expect(h.y).toBe(15 * j);
    expect(h.x).toBeCloseTo(m * 5 * Math.sqrt(3), 9);
    const sq = 75 * m * m + 225 * j * j;
    const foot = isqrt(Math.floor(sq / 100));
    const isWhole = sq % 100 === 0 && foot * foot === sq / 100; // a whole number of feet out
    const master = Math.floor(Math.sqrt(h.x ** 2 + h.y ** 2) / 10); // master's src/lib/distance.js:3-4
    if (isWhole) whole += 1;
    if (master !== foot) {
      expect([isWhole, master]).toEqual([true, foot - 1]); // sqrt errs only on whole-foot centres, one foot short
      short.push(`${m},${j}`);
    } else expect(h.leagueFgPct).toBe(readFoot(LEAGUE.byFoot, master)); // master's foot everywhere else
    expect(h.leagueFgPct).toBe(readFoot(LEAGUE.byFoot, foot)); // and the true foot everywhere
  }
  expect(whole).toBe(27); // 14 of them (12 on the axis, and (±27·5√3, 135)) read right under sqrt too
  expect(short.sort().join(" ")).toBe(
    ["-18,6", "-24,8", "-3,1", "-6,2", "-9,3", "15,5", "18,6", "21,7", "24,8", "3,-1", "3,1", "6,2", "9,3"]
      .sort()
      .join(" "),
  );
  // the cells beside the rim, (±15√3, ±15), 3 ft out: league 3 ft (0.572), where master read 2 ft (0.669)
  const rimSide = cells.filter((h) => Math.abs(h.y) === 15 && Math.abs(Math.round(h.x)) === 26);
  expect(rimSide.map((h) => [Math.round(h.x), h.y]).sort()).toEqual([
    [-26, 15],
    [26, -15],
    [26, 15],
  ]);
  for (const h of rimSide) expect(h.leagueFgPct).toBe(0.5717731325829557);
  expect([LEAGUE.byFoot[3]?.fgPct, LEAGUE.byFoot[2]?.fgPct]).toEqual([
    0.5717731325829557, 0.6686506853055206,
  ]);
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
