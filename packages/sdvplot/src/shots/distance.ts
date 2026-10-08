// Distance and side bins, ported from blazing-the-nets `main` lib/data/aggregate.ts (@31427b8), plus `master`'s
// distance baseline for cells (src/components/Hexagon/index.js @35dfda6). Pure; the parity gate is fixtures/shots/oracle.json.
import type { BinnerOptions } from "../bins/index.js";
import { InputError } from "../errors.js";
import { type CellVsLeague, type ShotRow, type Split, binShots, made, split } from "./aggregate.js";

export interface DistanceBin extends Split {
  /** First foot of the bin; `shot_distance` is rounded, so a 1-ft bin is centred on it. */
  readonly distance: number;
  /** Share of the attempts within `maxFt`. */
  readonly share: number;
}

/** The number of `binFt` bins from 0 to `maxFt`; both must be finite numbers above 0 (else InputError, naming it). */
function binCount(binFt: number, maxFt: number): number {
  for (const [name, v] of Object.entries({ binFt, maxFt }))
    if (!(Number.isFinite(v) && v > 0))
      throw new InputError(`${name} must be a finite number > 0, got ${String(v)}`);
  return Math.floor(maxFt / binFt) + 1;
}

/**
 * FG% by `shot_distance` in `binFt` bins from 0 to `maxFt`; longer attempts are left out (aggregate.ts:177-192).
 * The total within `maxFt` is the sum of `attempts`. `binFt` and `maxFt` must be finite numbers above 0 (else
 * InputError).
 *
 * @example
 * ```ts
 * import { fgPctByDistance } from "@sportsdataverse/sdvplot/shots";
 *
 * fgPctByDistance([{ x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" }], 3)[0];
 * ```
 */
export function fgPctByDistance(shots: readonly ShotRow[], binFt = 1, maxFt = 35): DistanceBin[] {
  const bins = Array.from({ length: binCount(binFt, maxFt) }, () => ({ attempts: 0, makes: 0 }));
  let total = 0;
  for (const s of shots) {
    if (s.shot_distance > maxFt) continue;
    const b = bins[Math.floor(s.shot_distance / binFt)];
    if (b === undefined) continue; // a negative distance
    b.attempts += 1;
    if (made(s)) b.makes += 1;
    total += 1;
  }
  return bins.map((b, i) => ({
    distance: i * binFt,
    ...split(b.attempts, b.makes),
    share: total ? b.attempts / total : 0,
  }));
}

export interface DistanceVsLeague extends DistanceBin {
  readonly leagueFgPct: number | null;
  /** Player minus league FG% (a fraction), null when either side has no attempts. */
  readonly diff: number | null;
}

/**
 * Pair player and league distance bins (same `binFt` and `maxFt`, else InputError) and take the difference
 * (aggregate.ts:200-209).
 *
 * @example
 * ```ts
 * import { fgPctByDistance, vsLeague } from "@sportsdataverse/sdvplot/shots";
 *
 * const shot = { x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" };
 * vsLeague(fgPctByDistance([shot]), fgPctByDistance([shot, { ...shot, shot_result: "Missed" }]))[0];
 * ```
 */
export function vsLeague(player: readonly DistanceBin[], league: readonly DistanceBin[]): DistanceVsLeague[] {
  if (player.length !== league.length || player.some((b, i) => b.distance !== league[i]?.distance)) {
    throw new InputError("vsLeague: player and league bins differ (use the same binFt and maxFt)");
  }
  return player.map((b, i) => {
    const leagueFgPct = league[i]?.fgPct ?? null;
    return {
      ...b,
      leagueFgPct,
      diff: b.fgPct !== null && leagueFgPct !== null ? b.fgPct - leagueFgPct : null,
    };
  });
}

export interface SideBin {
  readonly distance: number;
  readonly left: Split;
  readonly centre: Split;
  readonly right: Split;
}

/**
 * Left / centre / right of the hoop by distance (aggregate.ts:218-240): left is `x < -centreHalfWidth`, right is
 * `x > centreHalfWidth`. The default 0 puts `x == 0` in centre (`main`); `false` drops it, as `master`'s
 * `binLeftRight` did (`src/utils/visuals/bin.ts:36-42`). `binFt` and `maxFt` as for `fgPctByDistance`.
 *
 * @example
 * ```ts
 * import { statsBySide } from "@sportsdataverse/sdvplot/shots";
 *
 * statsBySide([{ x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" }], 3, 35, 7.5)[0];
 * ```
 */
export function statsBySide(
  shots: readonly ShotRow[],
  binFt = 1,
  maxFt = 35,
  centreHalfWidth: number | false = 0,
): SideBin[] {
  const half = centreHalfWidth === false ? 0 : centreHalfWidth;
  const acc = Array.from({ length: binCount(binFt, maxFt) }, () => ({
    left: [0, 0],
    centre: [0, 0],
    right: [0, 0],
  }));
  for (const s of shots) {
    if (s.shot_distance > maxFt) continue;
    const bin = acc[Math.floor(s.shot_distance / binFt)];
    if (bin === undefined) continue;
    const x = s.x_legacy;
    const side =
      x < -half ? bin.left : x > half ? bin.right : centreHalfWidth === false ? undefined : bin.centre;
    if (side === undefined) continue;
    side[0] = (side[0] ?? 0) + 1;
    if (made(s)) side[1] = (side[1] ?? 0) + 1;
  }
  return acc.map((b, i) => ({
    distance: i * binFt,
    left: split(b.left[0] ?? 0, b.left[1] ?? 0),
    centre: split(b.centre[0] ?? 0, b.centre[1] ?? 0),
    right: split(b.right[0] ?? 0, b.right[1] ?? 0),
  }));
}

/**
 * Player cells against the league FG% at the cell centre's distance, `floor(|centre| / 10)` ft, falling back one
 * foot when that bin is empty (blazing-the-nets `master` `src/components/Hexagon/index.js:44-49`). `cell` is a
 * hexagon radius (default 10, master's) or any `binner` lattice, e.g. `{ shape: "square", side: 10 }`.
 *
 * The distance is `Math.hypot(x, y)`, a deliberate divergence from master's `Math.sqrt(x ** 2 + y ** 2)`
 * (`src/lib/distance.js:3-4`). On a hexagon centre exactly a whole number of feet out, such as (15√3, 15) at 3 ft,
 * master's sqrt returns 29.999…96 and reads the foot below; hypot reads the true foot. On the real BKN fixture at
 * radius 10 that is 13 of 374 cells, among them the cells beside the rim (0.572 at 3 ft, where master reads 0.669
 * at 2 ft). Every other cell reads master's foot.
 *
 * @example
 * ```ts
 * import { cellsVsDistance, fgPctByDistance } from "@sportsdataverse/sdvplot/shots";
 *
 * const shot = { x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" };
 * cellsVsDistance([shot], fgPctByDistance([shot, shot]), { shape: "square", side: 10 });
 * ```
 */
export function cellsVsDistance(
  player: readonly ShotRow[],
  byFoot: readonly DistanceBin[],
  cell: number | BinnerOptions = 10,
): CellVsLeague[] {
  return binShots(player, cell).map((h) => {
    // hypot, not master's sqrt(x ** 2 + y ** 2) (distance.js:3-4), which reads a whole-foot centre one foot short
    const d = Math.floor(Math.hypot(h.x, h.y) / 10);
    return { ...h, leagueFgPct: byFoot[d]?.fgPct ?? byFoot[d - 1]?.fgPct ?? null };
  });
}
