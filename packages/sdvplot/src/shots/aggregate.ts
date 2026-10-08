// Cell aggregations, ported from blazing-the-nets `main` lib/data/aggregate.ts (@31427b8). Pure; the parity gate
// is fixtures/shots/oracle.json (hexagons). Squares (J38) run the same code on `squarebin`'s lattice.
import { BASKETBALL_ZONES, type BasketballZone, basketballZoneOf } from "@sportsdataverse/sporty";
import { type Binner, type BinnerOptions, type Lattice, binner } from "../bins/index.js";

/** A number is a hexagon radius (the parity default); an object is any lattice, squares included (J38). */
const latticeOf = (cell: number | BinnerOptions): Binner =>
  binner(typeof cell === "number" ? { radius: cell } : cell);

/**
 * One field-goal attempt, as the `nba_stats_shots` release ships it: `x_legacy`/`y_legacy` in tenths of a foot,
 * hoop at the origin, y toward half court; `shot_distance` in ROUNDED feet. Map other schemas once, first.
 */
export interface ShotRow {
  readonly x_legacy: number;
  readonly y_legacy: number;
  readonly shot_distance: number;
  /** 2 or 3; zones read it (the scorer's call, not the coordinates). */
  readonly shot_value: number;
  /** `"Made"` or `"Missed"`. */
  readonly shot_result: string;
}

export interface Split {
  readonly attempts: number;
  readonly makes: number;
  readonly fgPct: number | null;
}

/** @internal */
export const made = (s: ShotRow): boolean => s.shot_result === "Made"; // aggregate.ts:14
/** @internal */
export const split = (attempts: number, makes: number): Split => ({
  attempts,
  makes,
  fgPct: attempts > 0 ? makes / attempts : null,
}); // aggregate.ts:16-18

/** The shot's zone (sporty, legacy tenths). */
export const shotZone = (s: ShotRow): BasketballZone =>
  basketballZoneOf(s.x_legacy, s.y_legacy, s.shot_value, { scale: 10 });

/** Inside the sidelines and in front of the baseline (aggregate.ts:81-84); releases carry a few impossible points. */
const onCourt = (s: ShotRow): boolean => Math.abs(s.x_legacy) <= 250 && s.y_legacy >= -52.5;

export interface CellBin extends Split {
  /** Cell centre, legacy tenths. */
  readonly x: number;
  readonly y: number;
  readonly meanDistance: number;
  /** The zone most of the cell's attempts fall in (first seen wins a tie). */
  readonly zone: BasketballZone;
}

/**
 * Bin shots in DATA space (legacy tenths), dropping off-court points (aggregate.ts:86-104). `cell` is a hexagon
 * radius (10 = a 1 ft hex) or any `binner` lattice, e.g. `{ shape: "square", side: 15 }`. Bins come out in
 * first-seen order (d3-hexbin's, for hexagons).
 *
 * @example
 * ```ts
 * import { binShots } from "@sportsdataverse/sdvplot/shots";
 *
 * const shot = { x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" };
 * binShots([shot], 15);
 * binShots([shot], { shape: "square", side: 15 });
 * ```
 */
export function binShots(shots: readonly ShotRow[], cell: number | BinnerOptions): CellBin[] {
  const bins = latticeOf(cell).bins(shots.filter(onCourt), {
    x: (s) => s.x_legacy,
    y: (s) => s.y_legacy,
  });
  return bins.map((b) => {
    let distance = 0;
    let makes = 0;
    const zones = new Map<BasketballZone, number>();
    for (const s of b) {
      distance += s.shot_distance;
      if (made(s)) makes += 1;
      const z = shotZone(s);
      zones.set(z, (zones.get(z) ?? 0) + 1);
    }
    let zone: BasketballZone = "mid_range";
    let most = -1;
    for (const [z, n] of zones) {
      if (n > most) {
        zone = z;
        most = n;
      }
    }
    return { x: b.x, y: b.y, ...split(b.length, makes), meanDistance: distance / b.length, zone };
  });
}

/**
 * League attempts behind a cell's league rate before it falls back to the zone, and the colour prior: one number for
 * both (aggregate.ts:106-110). It is blazing-the-nets' tunable, set in its commit 25c3ab9f ("shrunk colours"), not a
 * derived or measured constant; `cellsVsLeague`'s `minLeague`, `shrunkDiff`'s `k` and `signaturePoints`' `prior`
 * override it per call.
 */
export const LEAGUE_PRIOR_ATTEMPTS = 25;

/**
 * FG% minus the league rate `league`, shrunk toward it by a `k`-attempt prior: `(makes + k*L)/(attempts + k) - L`
 * (aggregate.ts:112-119). `k = 0` is the raw difference (blazing-the-nets `master`). For colour, not labels.
 *
 * @example
 * ```ts
 * import { LEAGUE_PRIOR_ATTEMPTS, shrunkDiff } from "@sportsdataverse/sdvplot/shots";
 *
 * shrunkDiff(20, 20, 0.5, LEAGUE_PRIOR_ATTEMPTS); // 20-for-20 against a 50% league: hot, but +0.22, not +0.5
 * ```
 */
export function shrunkDiff(
  makes: number,
  attempts: number,
  league: number,
  k: number = LEAGUE_PRIOR_ATTEMPTS,
): number {
  return (makes + k * league) / (attempts + k) - league;
}

export interface LeagueCell {
  readonly x: number;
  readonly y: number;
  readonly attempts: number;
  readonly fgPct: number | null;
}
/**
 * A season's league cells and zone rates on one lattice (`{ radius }` for hexagons, `{ shape: "square", side }`):
 * plain JSON, computed once (aggregate.ts:125-146). blazing-the-nets names the cells `hexes`; here they are `cells`
 * for either shape, so map that key when loading its JSON.
 */
export type LeagueIndex = Lattice & {
  readonly cells: readonly LeagueCell[];
  readonly zones: Readonly<Record<BasketballZone, Split>>;
};
export interface CellVsLeague extends CellBin {
  readonly leagueFgPct: number | null;
}

/**
 * The league index every player chart compares against (aggregate.ts:140-146), on a hexagon radius or any `binner`
 * lattice; it stores the resolved lattice, so `equalArea` becomes the square's `side`.
 *
 * @example
 * ```ts
 * import { leagueIndex } from "@sportsdataverse/sdvplot/shots";
 *
 * leagueIndex([{ x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" }], 15).cells;
 * ```
 */
export function leagueIndex(league: readonly ShotRow[], cell: number | BinnerOptions): LeagueIndex {
  const { lattice } = latticeOf(cell);
  return {
    ...lattice,
    cells: binShots(league, lattice).map(({ x, y, attempts, fgPct }) => ({ x, y, attempts, fgPct })),
    zones: statsByZone(league),
  };
}

const centres = new WeakMap<LeagueIndex, Map<string, LeagueCell>>();
/**
 * Player cells with the league FG% of the SAME cell (the player is binned on the index's own lattice, so the
 * centres are equal); a cell the league shot fewer than `minLeague` times from falls back to its zone's league rate
 * (aggregate.ts:155-165; blazing-the-nets `main`).
 *
 * @example
 * ```ts
 * import { cellsVsLeague, leagueIndex } from "@sportsdataverse/sdvplot/shots";
 *
 * const shot = { x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" };
 * cellsVsLeague([shot], leagueIndex([shot, shot], 15));
 * ```
 */
export function cellsVsLeague(
  player: readonly ShotRow[],
  league: LeagueIndex,
  minLeague: number = LEAGUE_PRIOR_ATTEMPTS,
): CellVsLeague[] {
  let byCentre = centres.get(league);
  if (byCentre === undefined) {
    byCentre = new Map(league.cells.map((h) => [`${h.x},${h.y}`, h]));
    centres.set(league, byCentre);
  }
  const index = byCentre;
  return binShots(player, league).map((h) => {
    const l = index.get(`${h.x},${h.y}`);
    return { ...h, leagueFgPct: l && l.attempts >= minLeague ? l.fgPct : league.zones[h.zone].fgPct };
  });
}

/** How a cell's attempts set its size: `main` (sqrt to the 95th percentile) or `master` (linear, capped). */
export type SizeRule = "sqrt-p95" | "linear-cap";
export interface CellSizes {
  /** Size per cell in legacy tenths: a hexagon's circumradius, or a square's side. 0 hides a cell. */
  readonly r: readonly number[];
  /** Attempts at which size saturates. */
  readonly cap: number;
  /** The size of any attempt count, for a size key. */
  readonly size: (attempts: number) => number;
  /** A size key: 1, half the cap, the cap (blazing-the-nets `main` `lib/charts/hexShotChart.ts:199`). */
  readonly steps: readonly number[];
}

/** d3-array 3.2.4 `quantile` (src/quantile.js:10-20, R-7) over finite values; undefined when there are none. */
function quantile(values: readonly number[], p: number): number | undefined {
  const v = values.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return undefined;
  if (p <= 0 || n < 2) return v[0];
  if (p >= 1) return v[n - 1];
  const i = (n - 1) * p;
  const i0 = Math.floor(i);
  const v0 = v[i0] as number;
  const v1 = v[i0 + 1] as number;
  return v0 + (v1 - v0) * (i - i0);
}

/**
 * Frequency size for each cell (the dual encoding's size half; colour is `diffScale`), on the lattice's full cell
 * size `R` (a hexagon's radius, or a square's side; pass the index itself: `sizeCells(cells, index)`).
 * `"sqrt-p95"` (default, `main` `hexShotChart.ts:65-81`): a sqrt scale of attempts to `R`, capped at the 95th
 * percentile so one busy rim cell does not shrink the rest; area follows attempts for either shape.
 * `"linear-cap"` (`master` `Hexagon/index.js:22-30`): attempts in tenths, capped at `R`, cells under 2 attempts
 * hidden.
 *
 * @example
 * ```ts
 * import { sizeCells } from "@sportsdataverse/sdvplot/shots";
 *
 * sizeCells([{ attempts: 1 }, { attempts: 4 }, { attempts: 40 }], { radius: 15 }).r;
 * ```
 */
export function sizeCells(
  cells: readonly { readonly attempts: number }[],
  o: BinnerOptions & { readonly rule?: SizeRule },
): CellSizes {
  const R = binner(o).size; // throws InputError on a size that is not a finite number > 0
  let cap: number;
  let size: (a: number) => number;
  if ((o.rule ?? "sqrt-p95") === "sqrt-p95") {
    cap = Math.max(
      2,
      Math.ceil(
        quantile(
          cells.map((h) => h.attempts),
          0.95,
        ) ?? 2,
      ),
    );
    const top = Math.sqrt(cap);
    size = (a) => R * Math.min(1, Math.max(0, Math.sqrt(Math.max(0, a)) / top));
  } else {
    cap = R;
    size = (a) => (a > R ? R : a < 2 ? 0 : a);
  }
  return {
    r: cells.map((h) => size(h.attempts)),
    cap,
    size,
    steps: [1, Math.max(2, Math.round(cap / 2)), cap],
  };
}

/**
 * Attempts, makes and FG% per zone (aggregate.ts:269-277).
 *
 * @example
 * ```ts
 * import { statsByZone } from "@sportsdataverse/sdvplot/shots";
 *
 * statsByZone([{ x_legacy: -224, y_legacy: 20, shot_distance: 22, shot_value: 3, shot_result: "Made" }]);
 * ```
 */
export function statsByZone(shots: readonly ShotRow[]): Record<BasketballZone, Split> {
  const acc = new Map<BasketballZone, [number, number]>(BASKETBALL_ZONES.map((z) => [z, [0, 0]]));
  for (const s of shots) {
    const z = acc.get(shotZone(s));
    if (z === undefined) continue;
    z[0] += 1;
    if (made(s)) z[1] += 1;
  }
  return Object.fromEntries(
    BASKETBALL_ZONES.map((z) => {
      const [a, m] = acc.get(z) ?? [0, 0];
      return [z, split(a, m)];
    }),
  ) as Record<BasketballZone, Split>;
}
