import type { League, LeagueData, MarkRow } from "./data/index.js";
import { InputError, UnresolvedTeamError, warn } from "./errors.js";
import { getLeagueSync, loadLeague } from "./index-data.js";
import { normSeason } from "./normalize.js";
import { type ResolveOptions, type Value, resolveSync } from "./resolve.js";
import type { IdSystem, MarkType, SeasonInput, Variant } from "./types.js";

export interface SelectOptions {
  season?: SeasonInput;
  variant?: Variant;
  markType?: MarkType;
}
export interface LogoUrlOptions extends SelectOptions {
  idSystem?: IdSystem;
  strict?: boolean;
}

/** Drops undefined values (exactOptionalPropertyTypes). */
const ro = (o: {
  season?: SeasonInput;
  idSystem?: IdSystem | undefined;
  strict?: boolean | undefined;
}): ResolveOptions => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const covers = (lo: number | null, hi: number | null, s: number): boolean =>
  (lo === null || s >= lo) && (hi === null || s <= hi);

function checkMarkType(markType: string): void {
  if (markType !== "logo" && markType !== "wordmark")
    throw new InputError(`markType must be "logo" or "wordmark", got ${JSON.stringify(markType)}`);
}
function checkVariant(variant: string, league: League, d: LeagueData): void {
  if (variant === "default" || variant === "dark") return;
  const known = new Set(d.marks.map((m) => m.variant));
  if (!known.has(variant))
    throw new InputError(
      `unknown variant ${JSON.stringify(variant)} for ${league}; use "default", "dark" or one of ${[...known].sort().join(", ")}`,
    );
}

/** Port of `select_mark` (post-preload): requested variant, then (keeping polarity) default / polarity variants, then any; within each, season-covering rows (dated before open-ended), else the best row. Rows are already ranked best-first. */
export function selectMarkSync(team: Value, league: League, o: SelectOptions = {}): MarkRow | undefined {
  const markType = o.markType ?? "logo";
  const variant = o.variant ?? "default";
  checkMarkType(markType);
  const s = normSeason(o.season, league);
  const d = getLeagueSync(league);
  checkVariant(variant, league, d);
  const teamId = resolveSync(team, league, { season: s });
  if (teamId === undefined) return undefined;
  const rows = d.marks.filter((r) => r.team_id === teamId && r.mark_type === markType);
  const side = variant === "dark" ? "dark" : "light";
  const polarity = (v: string): boolean => v === `on_${side}` || v.endsWith(`_on_${side}`);
  const requested = (v: string): boolean => v === variant;
  const dflt = (v: string): boolean => v === "default";
  const order = side === "dark" ? [requested, polarity, dflt] : [requested, dflt, polarity];
  for (const keep of [...order, null]) {
    const found = keep ? rows.filter((r) => keep(r.variant)) : rows;
    if (s !== null) {
      const covering = found.filter((r) => covers(r.valid_from, r.valid_to, s));
      const dated = covering.filter((r) => r.valid_from !== null || r.valid_to !== null);
      for (const set of [dated, covering]) if (set.length) return set[0];
    }
    if (found.length) return found[0];
  }
  return undefined;
}
export async function selectMark(
  team: Value,
  league: League,
  o: SelectOptions = {},
): Promise<MarkRow | undefined> {
  await loadLeague(league);
  return selectMarkSync(team, league, o);
}

/** Port of `logo_url` (post-preload): archive URL of the team's logo/wordmark for the season; `undefined` for an unknown team (the resolver warns) or when no mark of that type exists (one warning). */
export function logoUrlSync(team: Value, league: League, o: LogoUrlOptions = {}): string | undefined {
  const markType = o.markType ?? "logo";
  checkMarkType(markType);
  checkVariant(o.variant ?? "default", league, getLeagueSync(league));
  const teamId = resolveSync(team, league, ro({ season: o.season, idSystem: o.idSystem, strict: o.strict }));
  if (teamId === undefined) return undefined;
  const row = selectMarkSync(teamId, league, o);
  if (row === undefined) {
    warn(
      `marks:${league}:${teamId}:${markType}`,
      `no ${markType} archived for '${String(team)}' (${league})`,
    );
    return undefined;
  }
  return row.archive_url;
}
export async function logoUrl(
  team: Value,
  league: League,
  o: LogoUrlOptions = {},
): Promise<string | undefined> {
  await loadLeague(league);
  return logoUrlSync(team, league, o);
}

/**
 * Every archived mark for one team, best first (logos and wordmarks, every variant and source).
 * Reads the committed shard (deduped, ranked rows); the FULL-manifest listing is a later phase.
 * Throws `UnresolvedTeamError` when the team is null or does not resolve (strict, as Python).
 */
export async function marks(
  team: Value,
  league: League,
  o: { season?: SeasonInput; idSystem?: IdSystem } = {},
): Promise<readonly MarkRow[]> {
  const d = await loadLeague(league);
  const teamId = resolveSync(team, league, ro({ season: o.season, idSystem: o.idSystem, strict: true }));
  if (teamId === undefined) throw new UnresolvedTeamError(`marks() needs a team, got ${String(team)}`);
  return d.marks.filter((r) => r.team_id === teamId);
}
