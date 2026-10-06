import type { League } from "./data/index.js";
import { InputError } from "./errors.js";
import { seasonBounds } from "./index-data.js";
import type { SeasonInput } from "./types.js";

const FLOAT_ID = /^-?\d+\.0+$/;
const PUNCT: Record<string, string> = { "‘": "'", "’": "'", "–": "-", "—": "-" };

/** Port of `_normalize.norm_value`: trimmed, accents + typographic punctuation folded, case-folded, integral numbers without ".0". */
export function normValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isNaN(value) ? null : String(value);
  let s = String(value).trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII fast-path test
  if (!/^[\x00-\x7F]*$/.test(s))
    s = s
      .replace(/[‘’–—]/g, (c) => PUNCT[c] ?? c)
      .normalize("NFKD")
      .replace(/\p{M}/gu, "");
  s = s.toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ"); // Python casefold ≈ toLowerCase for these inputs; the oracle (Task 7) confirms
  if (FLOAT_ID.test(s)) s = s.split(".")[0] as string;
  return s || null;
}

export function checkSeason(year: number, league?: League): void {
  const b = seasonBounds(league);
  if (b && !(b[0] <= year && year <= b[1]))
    throw new InputError(
      `season ${year} is outside the seasons sdvplot knows${league ? ` for ${league}` : ""} (${b[0]} to ${b[1]}); pass a year such as 2020`,
    );
}

const SPLIT = /^\s*(\d{4})\s*[-/]\s*(\d{2}|\d{4})\s*$/;
export function normSeason(value: SeasonInput, league?: League): number | null {
  if (value === null || value === undefined) return null;
  let year: number | null = null;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return null;
    if (Number.isInteger(value)) year = value;
  } else if (/^\d+$/.test(value.trim())) year = Number.parseInt(value.trim(), 10);
  if (year === null) {
    const m = typeof value === "string" ? SPLIT.exec(value) : null;
    const hint = m
      ? `; for a split season pass its ending year (${Number(m[1]) + 1} for '${String(value).trim()}')`
      : "";
    throw new InputError(`season must be a year such as 2020, got ${JSON.stringify(value)}${hint}`);
  }
  checkSeason(year, league);
  return year;
}
