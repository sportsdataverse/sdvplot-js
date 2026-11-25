import type { League } from "./data/index.js";
import { InputError } from "./errors.js";
import { checkLeague, getLeagueSync, loadLeague } from "./index-data.js";
import { type ResolveOptions, type Value, report, resolveIds, resolveSync, seasons } from "./resolve.js";

/** The `teams` column `cleanNames` returns. */
export type CleanColumn = "location" | "short_name" | "name" | "abbr" | "team_id";
const CLEAN_COLUMNS: readonly string[] = ["location", "short_name", "name", "abbr", "team_id"];

/** Options of `cleanNames`. */
export interface CleanNamesOptions extends ResolveOptions {
  /** The `teams` column to return: `"location"` (the default; the school in college sports, the city in the pros). */
  column?: CleanColumn;
  /** True (the default) keeps a value that does not resolve as it is, quietly; false makes it `undefined`, with one warning. */
  keepNonMatches?: boolean;
}

/** A value as text the way sdvplotR's id_chr() and Python's `_id_str` write it: 14 is "14"; null stays undefined. */
function idStr(v: Value): string | undefined {
  if (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) return undefined;
  return String(v);
}

/**
 * One display name per team value, for joins and labels (Python `clean_names`, sdvplotR's `sdv_clean_names()`,
 * cfbplotR's `clean_school_names()`; with `column: "abbr"`, `clean_team_abbrs()`). Every alias and id system `resolve`
 * reads cleans to the same name; a value it cannot resolve without guessing is kept as given (`keepNonMatches`, the
 * default) or `undefined`. `strict: true` throws for one either way. Call after the league is loaded.
 */
export function cleanNamesSync<T extends Value | readonly Value[]>(
  values: T,
  league: League,
  opts: CleanNamesOptions = {},
): T extends readonly Value[] ? (string | undefined)[] : string | undefined {
  const column = opts.column ?? "location";
  if (!CLEAN_COLUMNS.includes(column))
    throw new InputError(`column must be one of ${CLEAN_COLUMNS.join(", ")}, got ${JSON.stringify(column)}`);
  checkLeague(league);
  const d = getLeagueSync(league);
  const arr = Array.isArray(values);
  const items = (arr ? values : [values]) as readonly Value[];
  const keep = opts.keepNonMatches ?? true;
  const { out: ids, unresolved } = resolveIds(
    items,
    league,
    seasons(opts.season, items.length, league),
    opts.idSystem ?? "auto",
    d,
  );
  if (unresolved.size && (opts.strict || !keep)) report(unresolved, league, opts.strict ?? false);
  const names = new Map(d.teams.map((t) => [t.team_id, t[column as CleanColumn] ?? undefined]));
  const out = items.map((v, i) => {
    const id = ids[i];
    return id !== undefined ? names.get(id) : keep ? idStr(v) : undefined;
  });
  return (arr ? out : out[0]) as never;
}

/**
 * `cleanNamesSync`, loading the league first.
 *
 * @example
 * ```ts
 * import { cleanNames } from "@sportsdataverse/sdvplot";
 *
 * await cleanNames(["utah", "San Jose State", "Hawaii", "UTSA", "SLC"], "cfb");
 * await cleanNames(["Kansas City Chiefs", "OAK"], "nfl", { column: "abbr" }); // ["KC", "LV"]
 * ```
 */
export async function cleanNames<T extends Value | readonly Value[]>(
  values: T,
  league: League,
  opts: CleanNamesOptions = {},
): Promise<T extends readonly Value[] ? (string | undefined)[] : string | undefined> {
  await loadLeague(league);
  return cleanNamesSync(values, league, opts);
}

/** A categorical of team values: each value (or `undefined`) and the ordered categories. */
export interface TeamFactor {
  /** The values as text, `undefined` where a value does not resolve. */
  values: (string | undefined)[];
  /** The resolved values (the first of each), ordered by each team's abbreviation (its team_id when it has none), then value. */
  levels: string[];
}

/**
 * Team values as a categorical in team order (Python `team_factor`, sdvplotR's `sdv_team_factor()`, cfbplotR's
 * `cfb_team_factor()`): pass `levels` as a band scale's domain or a legend's order. A value that does not resolve is
 * `undefined`, with the resolver's warning. Call after the league is loaded.
 */
export function teamFactorSync(
  teams: readonly Value[],
  league: League,
  opts: ResolveOptions = {},
): TeamFactor {
  checkLeague(league);
  const values = teams.map(idStr);
  const ids = resolveSync(values, league, opts);
  const abbr = new Map(getLeagueSync(league).teams.map((t) => [t.team_id, t.abbr]));
  const seen = new Set<string | undefined>();
  const keyed: [string, string][] = [];
  values.forEach((v, i) => {
    const id = ids[i];
    if (id !== undefined && v !== undefined && !seen.has(v)) keyed.push([abbr.get(id) || id, v]); // R: !duplicated
    seen.add(v);
  });
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const levels = keyed.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1])).map(([, v]) => v);
  const known = new Set(levels); // a value whose first occurrence did not resolve is no level: undefined, as R's factor()
  return {
    values: values.map((v, i) => (ids[i] !== undefined && v !== undefined && known.has(v) ? v : undefined)),
    levels,
  };
}

/**
 * `teamFactorSync`, loading the league first.
 *
 * @example
 * ```ts
 * import { teamFactor } from "@sportsdataverse/sdvplot";
 *
 * (await teamFactor(["KC", "BUF", "Kansas City Chiefs"], "nfl")).levels; // ["BUF", "KC", "Kansas City Chiefs"]
 * ```
 */
export async function teamFactor(
  teams: readonly Value[],
  league: League,
  opts: ResolveOptions = {},
): Promise<TeamFactor> {
  await loadLeague(league);
  return teamFactorSync(teams, league, opts);
}
