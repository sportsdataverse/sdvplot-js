// src/scale.ts — ports of sdvplot Python great_tables/_cells.py `_ramp` / `_ranks` and _layout.py `_quantile`.
import { mix } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "./errors.js";

/** Python `_ramp` (_cells.py:1027-1048): piecewise-linear sRGB over evenly spaced stops, as great_tables `data_color`; null outside the domain. */
export function ramp(
  palette: readonly string[],
  [lo, hi]: readonly [number, number],
): (v: number) => string | null {
  const k = palette.length - 1;
  return (v) => {
    if (!(lo <= v && v <= hi)) return null;
    if (k === 0) return palette[0] ?? null;
    const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    const i = Math.min(Math.floor(t * k), k - 1);
    return mix(palette[i] as string, palette[i + 1] as string, t * k - i);
  };
}

/** Python `_ranks` (_cells.py:1051-1066): R rank(ties = "average", na.last = "keep") ascending; desc flips it as top − r + 1, top = the largest rank. */
export function averageRanks(values: readonly (number | null)[], desc: boolean): (number | null)[] {
  const idx = values
    .map((v, i) => [v, i] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: (number | null)[] = values.map(() => null);
  for (let s = 0; s < idx.length; ) {
    let e = s;
    while (e + 1 < idx.length && idx[e + 1]?.[0] === idx[s]?.[0]) e++;
    const r = (s + e) / 2 + 1;
    for (let j = s; j <= e; j++) out[idx[j]?.[1] as number] = r;
    s = e + 1;
  }
  if (!desc || idx.length === 0) return out;
  let top = 0;
  for (const r of out) if (r !== null && r > top) top = r;
  return out.map((r) => (r === null ? null : top - r + 1));
}

export function domainOf(columns: readonly (readonly (number | null)[])[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const col of columns)
    for (const v of col)
      if (v !== null) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
  if (lo > hi) throw new TableSpecError("no domain given and no numeric value to derive one from");
  return [lo, hi];
}

/** Python `_quantile` (_layout.py:1159): R type-7 quantile. */
export function quantile7(xs: readonly number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  return (s[lo] as number) + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)] as number) - (s[lo] as number));
}

export function sampleSd(xs: readonly number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
