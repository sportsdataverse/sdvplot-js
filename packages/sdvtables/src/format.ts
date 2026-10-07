// src/format.ts — ports of sdvplot Python great_tables/_cells.py `_number` / `_natural` / `_format_value`.
// Rounding is HALF-TO-EVEN on exact binary ties, like Python's f-format and `round` (controller ruling R2);
// JS `toFixed` / `Math.round` round exact ties away from zero.

export const isBlank = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  (typeof v === "number" && Number.isNaN(v)) ||
  (typeof v === "string" && v.trim() === "");

/** Python `_number` (_cells.py:963-971): numbers, booleans and numeric strings; anything else (and NaN) is null. Infinities pass. */
export function toNumber(v: unknown): number | null {
  if (isBlank(v)) return null;
  if (typeof v === "string" && /^\s*[+-]?0[xXoObB]/.test(v)) return null; // JS Number() reads 0x10; Python float() does not
  const n =
    typeof v === "number"
      ? v
      : typeof v === "boolean"
        ? Number(v)
        : typeof v === "string"
          ? Number(v)
          : Number.NaN;
  return Number.isNaN(n) ? null : n;
}

const group = (s: string): string => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** `|x|` rounded to `digits` decimals as an integer string of `x * 10^digits`, exact on the double's binary value, ties to even. */
function scaledDigits(a: number, digits: number): string {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, a);
  const bits = dv.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const m = biased === 0 ? frac : frac | (1n << 52n);
  const e = (biased === 0 ? 1 : biased) - 1075; // a = m * 2^e
  const num = m * 10n ** BigInt(digits);
  if (e >= 0) return (num << BigInt(e)).toString();
  const k = BigInt(-e);
  let q = num >> k;
  const r = num & ((1n << k) - 1n);
  const half = 1n << (k - 1n);
  if (r > half || (r === half && (q & 1n) === 1n)) q += 1n;
  return q.toString();
}

/**
 * Python `f"{v:,.{digits}f}"`: fixed decimals for any `digits`, exact ties to even, sign kept even when the result rounds to zero
 * (`-0.04` -> `-0.0`). Pure BigInt on the double's exact binary value, so no `toFixed` 100-digit cap or exponent form at 1e21.
 */
function fixed(v: number, digits: number, big: boolean): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? "nan" : v > 0 ? "inf" : "-inf";
  const s = scaledDigits(Math.abs(v), digits).padStart(digits + 1, "0");
  const i = s.slice(0, s.length - digits);
  const f = s.slice(s.length - digits);
  return (v < 0 || Object.is(v, -0) ? "-" : "") + (big ? group(i) : i) + (digits > 0 ? `.${f}` : "");
}

/** Python `_natural` (_cells.py:974-980): decimals = what `f"{v:.7g}"` needs (up to 7 significant figures), then `v` itself is printed with them. */
export function naturalDigits(v: number, big = false): string {
  if (!Number.isFinite(v)) return v > 0 ? "Inf" : "-Inf";
  const exp = Number(Math.abs(v).toExponential(6).split("e")[1]);
  const seven = fixed(Math.abs(v), Math.max(0, 6 - exp), false); // 7 significant figures, ties to even
  const frac = seven.split(".")[1]?.replace(/0+$/, "") ?? "";
  return fixed(v, frac.length, big);
}

/**
 * Sign-glyph rule: great_tables prints negatives from fmt_number/fmt_percent with U+2212, so `formatValue`/`formatNumber`
 * (display text) swap the ASCII "-" for it. `fixed()`/`naturalDigits()` stay ASCII on purpose: `pxOf` feeds CSS via Number(fixed(...)).
 */
const minus = (s: string): string => s.replace(/-/g, "−");

export type FormatType = "number" | "comma" | "currency" | "percent";

/** Python `_format_value` (_cells.py:983-998): a missing value prints `NA`. */
export function formatValue(
  v: number | null,
  digits: number | null | undefined,
  formatType: FormatType,
  suffix: string,
): string {
  const big = formatType === "comma" || formatType === "currency";
  let core =
    v === null
      ? "NA"
      : digits === null || digits === undefined
        ? naturalDigits(v, big)
        : fixed(v, digits, big);
  if (formatType === "currency") core = `$${core}`;
  else if (formatType === "percent") core += "%";
  return minus(core) + suffix;
}

export function formatNumber(
  v: number,
  o: { digits?: number; big?: boolean; prefix?: string; suffix?: string; forceSign?: boolean } = {},
): string {
  const body = o.digits === undefined ? naturalDigits(v, o.big ?? false) : fixed(v, o.digits, o.big ?? false);
  const sign = o.forceSign && !body.startsWith("-") && Number(body.replace(/,/g, "")) !== 0 ? "+" : "";
  return `${o.prefix ?? ""}${sign}${minus(body)}${o.suffix ?? ""}`;
}

/** Python `_ordinal_suffix` (_cells.py:1460) on the truncated integer. */
export function ordinal(n: number): string {
  const t = Math.abs(Math.trunc(n));
  const m100 = t % 100;
  const suf = m100 >= 11 && m100 <= 13 ? "th" : (["th", "st", "nd", "rd"] as const)[t % 10 <= 3 ? t % 10 : 0];
  return `${Math.trunc(n)}${suf}`;
}

export const pxOf = (n: number): string => `${Number(fixed(n, 1, false))}px`;
