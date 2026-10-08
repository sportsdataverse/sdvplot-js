// signaturePoints ports blazing-the-nets `main` lib/charts/shootingSignature.ts:13-100 (@31427b8).
import { InputError } from "../errors.js";
import { LEAGUE_PRIOR_ATTEMPTS, shrunkDiff } from "./aggregate.js";
import type { DistanceVsLeague } from "./distance.js";

/** Gaussian kernel smoothing (`:27-39`); with `weights`, a weighted local mean. `sigma` 0 = no smoothing. */
export function kernelSmooth(
  values: readonly number[],
  weights: readonly number[] | null,
  sigma: number,
): number[] {
  if (sigma === 0) return [...values];
  const reach = Math.ceil(sigma * 3);
  return values.map((_, i) => {
    let num = 0;
    let den = 0;
    for (let j = Math.max(0, i - reach); j <= Math.min(values.length - 1, i + reach); j++) {
      const k = Math.exp(-((i - j) ** 2) / (2 * sigma * sigma)) * (weights ? (weights[j] ?? 0) : 1);
      num += k * (values[j] ?? 0);
      den += k;
    }
    return den > 0 ? num / den : 0;
  });
}

/** Gaussian kernel sums, weight 1 at the bin itself (`:42-51`): effective makes or attempts near each bin. */
export function kernelSum(values: readonly number[], sigma: number): number[] {
  if (sigma === 0) return [...values];
  const reach = Math.ceil(sigma * 3);
  return values.map((_, i) => {
    let sum = 0;
    for (let j = Math.max(0, i - reach); j <= Math.min(values.length - 1, i + reach); j++) {
      sum += Math.exp(-((i - j) ** 2) / (2 * sigma * sigma)) * (values[j] ?? 0);
    }
    return sum;
  });
}

export interface SignaturePoint {
  readonly distance: number;
  /** Effective makes / attempts near this distance; null (a gap in the ribbon) under `minAttempts`. */
  readonly fgPct: number | null;
  readonly leagueFgPct: number | null;
  readonly share: number;
  /** The colour value: `shrunkDiff(makes, attempts, league, prior)`, null in a gap. */
  readonly colourDiff: number | null;
}

export interface SignatureOptions {
  /** Feet between samples; default 0.25 (`:16`). `master` sampled each 1-ft bin. */
  step?: number;
  /** Kernel smoothing (sigma 0.9 ft for makes/attempts, 1 for share, 0.6 for league; `:17`, `:76-77`); default true. */
  smooth?: boolean;
  /** No ribbon past the last bin with this many attempts, nor where the effective attempts fall below it; default 5 (`:19-21`). */
  minAttempts?: number;
  /** Colour prior in attempts (`shrunkDiff` k); default 25. 0 = the raw difference (`master`). */
  prior?: number;
}

/**
 * The shooting signature's samples: FG% from separately kernel-summed makes and attempts (a stretch with no
 * shots is a gap, never 0%), the smoothed league FG% and shot share, and the shrunk colour value (`:69-100`).
 * Input: 1-ft bins from `vsLeague(fgPctByDistance(player), fgPctByDistance(league))`.
 *
 * @example
 * ```ts
 * import { fgPctByDistance, signaturePoints, vsLeague } from "@sportsdataverse/sdvplot/shots";
 *
 * const shot = { x_legacy: 0, y_legacy: 5, shot_distance: 0, shot_value: 2, shot_result: "Made" };
 * signaturePoints(vsLeague(fgPctByDistance([shot]), fgPctByDistance([shot])), { minAttempts: 1 })[0];
 * ```
 */
export function signaturePoints(
  bins: readonly DistanceVsLeague[],
  o: SignatureOptions = {},
): SignaturePoint[] {
  const step = o.step ?? 0.25;
  if (!(step > 0)) throw new InputError(`signaturePoints step must be > 0, got ${String(step)}`);
  const smooth = o.smooth ?? true;
  const min = o.minAttempts ?? 5;
  const prior = o.prior ?? LEAGUE_PRIOR_ATTEMPTS;
  const attempts = kernelSum(
    bins.map((b) => b.attempts),
    smooth ? 0.9 : 0,
  );
  const makes = kernelSum(
    bins.map((b) => b.makes),
    smooth ? 0.9 : 0,
  );
  const share = kernelSmooth(
    bins.map((b) => b.share),
    null,
    smooth ? 1 : 0,
  );
  const league = kernelSmooth(
    bins.map((b) => b.leagueFgPct ?? 0),
    bins.map((b) => (b.leagueFgPct === null ? 0 : 1)),
    smooth ? 0.6 : 0,
  );
  let end: number | null = null; // ribbonEnd (`:54-57`); a loop, not findLast (ES2023, outside the ES2022 lib)
  for (let i = bins.length - 1; i >= 0; i--) {
    const b = bins[i];
    if (b !== undefined && b.attempts >= min) {
      end = b.distance;
      break;
    }
  }
  const last = bins.length - 1;
  const lerp = (a: readonly number[], d: number): number => {
    const i = Math.min(Math.floor(d), last);
    const j = Math.min(i + 1, last);
    const ai = a[i] ?? 0;
    return ai + ((a[j] ?? 0) - ai) * (d - i);
  };
  return Array.from({ length: Math.round(last / step) + 1 }, (_, k) => {
    const d = k * step;
    const a = lerp(attempts, d);
    const m = lerp(makes, d);
    const hasLeague = bins[Math.min(Math.round(d), last)]?.leagueFgPct != null;
    const leagueFgPct = hasLeague ? lerp(league, d) : null;
    const ok = end !== null && d <= end && a >= min;
    return {
      distance: d,
      fgPct: ok ? m / a : null,
      leagueFgPct,
      share: lerp(share, d),
      colourDiff: ok && leagueFgPct !== null ? shrunkDiff(m, a, leagueFgPct, prior) : null,
    };
  });
}
