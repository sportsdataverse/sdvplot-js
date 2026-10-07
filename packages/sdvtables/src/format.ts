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

/** Round half to even (an exact `x.5` goes to the even neighbour), as Python's `round`. */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  return d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 === 0 ? f : f + 1;
}

const group = (s: string): string => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Python `f"{v:,.{digits}f}"`: fixed decimals, exact ties to even, sign kept even when the result rounds to zero (`-0.04` -> `-0.0`).
 * ponytail: tie detection reads the exact expansion to `digits + 60` places, which is exact while `digits` stays below ~13 (an
 * unrounded double has at most ~53 + 3.4 * digits significant decimals); raise the cap or go BigInt if wider output is ever needed.
 */
function fixed(v: number, digits: number, big: boolean): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? "nan" : v > 0 ? "inf" : "-inf";
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e21) {
    s = BigInt(a).toString() + (digits > 0 ? `.${"0".repeat(digits)}` : ""); // toFixed switches to exponent form here; these doubles are integers
  } else {
    s = a.toFixed(digits); // ties go up
    const [ti = "0", tf = ""] = a.toFixed(Math.min(100, digits + 60)).split(".");
    if (tf[digits] === "5" && /^0*$/.test(tf.slice(digits + 1))) {
      const down = digits > 0 ? `${ti}.${tf.slice(0, digits)}` : ti; // truncation = the round-down neighbour
      if (Number(down.slice(-1)) % 2 === 0) s = down;
    }
  }
  const [i = "0", f] = s.split(".");
  return (v < 0 || Object.is(v, -0) ? "-" : "") + (big ? group(i) : i) + (f ? `.${f}` : "");
}

/** Python `_natural` (_cells.py:974-980): decimals = what `f"{v:.7g}"` needs (up to 7 significant figures), then `v` itself is printed with them. */
export function naturalDigits(v: number, big = false): string {
  if (!Number.isFinite(v)) return v > 0 ? "Inf" : "-Inf";
  const exp = Number(Math.abs(v).toExponential(6).split("e")[1]);
  const seven = fixed(Math.abs(v), Math.max(0, 6 - exp), false); // 7 significant figures, ties to even
  const frac = seven.split(".")[1]?.replace(/0+$/, "") ?? "";
  return fixed(v, frac.length, big);
}

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
  return core + suffix;
}

export function formatNumber(
  v: number,
  o: { digits?: number; big?: boolean; prefix?: string; suffix?: string; forceSign?: boolean } = {},
): string {
  const body = o.digits === undefined ? naturalDigits(v, o.big ?? false) : fixed(v, o.digits, o.big ?? false);
  const sign = o.forceSign && !body.startsWith("-") && Number(body.replace(/,/g, "")) !== 0 ? "+" : "";
  return `${o.prefix ?? ""}${sign}${body}${o.suffix ?? ""}`;
}

/** Python `_ordinal_suffix` (_cells.py:1460) on the truncated integer. */
export function ordinal(n: number): string {
  const t = Math.abs(Math.trunc(n));
  const m100 = t % 100;
  const suf = m100 >= 11 && m100 <= 13 ? "th" : (["th", "st", "nd", "rd"] as const)[t % 10 <= 3 ? t % 10 : 0];
  return `${Math.trunc(n)}${suf}`;
}

export const pxOf = (n: number): string => `${roundHalfEven(n * 10) / 10}px`;
