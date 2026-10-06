import type { Alias } from "../../packages/sdvplot/src/data/index.js";
import { type RawMark, type StoredMark, archiveUrl, rankMarks } from "./emit.js";

export interface ManifestRow {
  level: string;
  league: string;
  entity_id: string;
  mark_type: string;
  variant: string;
  valid_from: string;
  valid_to: string;
  source: string;
  sha256: string;
  ext: string;
  width: string;
  height: string;
  archive_url: string;
  first_seen: string;
}
const int = (s: string): number | null => (s === "" ? null : Number.parseInt(s, 10));
/** archive_url reaches the web adapters' HTML (Python drops rows failing SAFE_URL); here a row must carry exactly the content-addressed URL the loader derives, or it is dropped. */
export const safeArchive = (m: Pick<ManifestRow, "archive_url" | "sha256" | "ext">): boolean =>
  m.archive_url === archiveUrl(m.sha256, m.ext);
const key = (source: string, id: string) => `${source}:${id}`.trim().toLowerCase();

/** mark aliases: key → (team_id, union range), unique team mappings only. */
export function markAliases(aliases: readonly Alias[]) {
  const by = new Map<
    string,
    { teams: Set<string>; from: number | null; to: number | null; anyOpenFrom: boolean; anyOpenTo: boolean }
  >();
  for (const a of aliases) {
    if (a.id_system !== "mark") continue;
    const k = a.value.trim().toLowerCase();
    const e = by.get(k) ?? {
      teams: new Set<string>(),
      from: null,
      to: null,
      anyOpenFrom: false,
      anyOpenTo: false,
    };
    e.teams.add(a.team_id);
    if (a.valid_from === null) e.anyOpenFrom = true;
    else e.from = e.from === null ? a.valid_from : Math.min(e.from, a.valid_from);
    if (a.valid_to === null) e.anyOpenTo = true;
    else e.to = e.to === null ? a.valid_to : Math.max(e.to, a.valid_to);
    by.set(k, e);
  }
  const out = new Map<string, { team_id: string; from: number | null; to: number | null }>();
  for (const [k, e] of by)
    if (e.teams.size === 1)
      out.set(k, {
        team_id: [...e.teams][0] as string,
        from: e.anyOpenFrom ? null : e.from,
        to: e.anyOpenTo ? null : e.to,
      });
  return out;
}

export function leagueMarks(
  league: string,
  manifest: readonly ManifestRow[],
  aliases: readonly Alias[],
): StoredMark[] {
  const ma = markAliases(aliases);
  const raw: RawMark[] = [];
  for (const m of manifest) {
    if (m.level !== "team" || m.league !== league) continue;
    const a = ma.get(key(m.source, m.entity_id));
    if (!a) continue;
    const vf = int(m.valid_from);
    const vt = int(m.valid_to);
    raw.push({
      team_id: a.team_id,
      mark_type: m.mark_type as "logo" | "wordmark",
      variant: m.variant,
      valid_from: vf === null ? a.from : a.from === null ? vf : Math.max(vf, a.from), // pl.max_horizontal (nulls ignored)
      valid_to: vt === null ? a.to : a.to === null ? vt : Math.min(vt, a.to), // pl.min_horizontal
      source: m.source,
      first_seen: m.first_seen,
      sha256: m.sha256,
      ext: m.ext,
      width: int(m.width),
      height: int(m.height),
    });
  }
  // J14: keep the best-ranked row per (team, mark_type, variant, valid_from, valid_to); selectMark only ever reads the
  // first row of a set filtered on exactly those fields, so the result is unchanged.
  const seen = new Set<string>();
  return rankMarks(raw).filter((r) => {
    const k = `${r.team_id}|${r.mark_type}|${r.variant}|${r.valid_from}|${r.valid_to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Sorted unique non-empty `variant` values over the WHOLE manifest (every row, no level/league filter), as Python's `_check_variant`. */
export const manifestVariants = (rows: readonly { variant: string }[]): string[] =>
  [...new Set(rows.map((r) => r.variant).filter((v) => v !== ""))].sort();
