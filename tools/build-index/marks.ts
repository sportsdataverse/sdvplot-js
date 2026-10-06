import type { Alias } from "../../packages/sdvplot/src/data/index.js";
import { type ManifestRow, manifestMarks } from "../../packages/sdvplot/src/manifest.js";
import type { StoredMark } from "./emit.js";

export { type ManifestRow, markAliases, safeArchive } from "../../packages/sdvplot/src/manifest.js";

export function leagueMarks(
  league: string,
  manifest: readonly ManifestRow[],
  aliases: readonly Alias[],
): StoredMark[] {
  // J14: keep the best-ranked row per (team, mark_type, variant, valid_from, valid_to); selectMark only ever reads the
  // first row of a set filtered on exactly those fields, so the result is unchanged.
  const seen = new Set<string>();
  return manifestMarks(league, manifest, aliases)
    .filter((r) => {
      const k = `${r.team_id}|${r.mark_type}|${r.variant}|${r.valid_from}|${r.valid_to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(({ archive_url: _derived, ...stored }) => stored);
}

/** Sorted unique non-empty `variant` values over the WHOLE manifest (every row, no level/league filter), as Python's `_check_variant`. */
export const manifestVariants = (rows: readonly { variant: string }[]): string[] =>
  [...new Set(rows.map((r) => r.variant).filter((v) => v !== ""))].sort();
