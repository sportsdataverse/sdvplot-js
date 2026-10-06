import { InputError, warn } from "./errors.js";
import { checkLeague, getLeagueSync, loadLeague } from "./index-data.js";
import { type ResolveOptions, type Resolved, type Value, resolveSync } from "./resolve.js";
import type { League, Which } from "./types.js";

export interface ColorOptions extends ResolveOptions {
  which?: Which;
}
export type ColorResult<T> = T extends readonly Value[] ? (string | undefined)[] : string | undefined;

const COLUMNS = { primary: "color_primary", secondary: "color_secondary" } as const;
function column(which: string): "color_primary" | "color_secondary" {
  if (which !== "primary" && which !== "secondary")
    throw new InputError(`which must be one of primary, secondary, got ${JSON.stringify(which)}`);
  return COLUMNS[which];
}
function colorMap(league: League, col: "color_primary" | "color_secondary"): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of getLeagueSync(league).teams) if (t[col]) m.set(t.team_id, t[col] as string);
  return m;
}

/** `{team: "#hex"}` for a league. Without `teams`: keyed by abbr, or team_id where abbr is null/shared (one warning). With `teams`: keyed by the caller's own values; first team wins on a reused value. */
export async function palette(
  league: League,
  teams?: Value | readonly Value[],
  opts: ColorOptions = {},
): Promise<Record<string, string>> {
  const col = column(opts.which ?? "primary");
  checkLeague(league);
  await loadLeague(league);
  const colors = colorMap(league, col);
  const out: Record<string, string> = Object.create(null);
  if (teams == null) {
    const rows = getLeagueSync(league).teams;
    const counts = new Map<string, number>();
    for (const t of rows) if (t.abbr) counts.set(t.abbr, (counts.get(t.abbr) ?? 0) + 1);
    const shared = [...counts].filter(([, n]) => n > 1).map(([a]) => a);
    if (shared.length)
      warn(
        `palette:shared:${league}`,
        `abbreviations shared by several ${league} teams are keyed by team_id: ${shared.sort().join(", ")}`,
      );
    for (const t of rows) {
      const c = colors.get(t.team_id);
      if (c === undefined) continue;
      out[!t.abbr || shared.includes(t.abbr) ? t.team_id : t.abbr] = c;
    }
    return out;
  }
  const values = (Array.isArray(teams) ? teams : [teams]) as readonly Value[];
  const slot = values.find((v) => v === "primary" || v === "secondary");
  if (slot !== undefined)
    throw new InputError(
      `${JSON.stringify(slot)} is a color slot, not a team; pass it as an option: palette(league, teams, { which: "${slot}" })`,
    );
  const ss: unknown[] = Array.isArray(opts.season) ? opts.season : Array(values.length).fill(opts.season);
  if (ss.length !== values.length)
    throw new InputError(`season has ${ss.length} values but there are ${values.length} teams`);
  const seen = new Set<string>();
  const vs: Value[] = [];
  const ys: ResolveOptions["season"][] = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined) return;
    const k = `${typeof v}:${String(v)}\u0000${String(ss[i])}`;
    if (seen.has(k)) return;
    seen.add(k);
    vs.push(v);
    ys.push(ss[i] as ResolveOptions["season"]);
  });
  const ids = resolveSync(vs, league, { ...opts, season: ys as never });
  vs.forEach((v, i) => {
    const id = ids[i];
    const c = id === undefined ? undefined : colors.get(id);
    if (c !== undefined) out[String(v)] ??= c;
  });
  return out;
}

/** One `#hex` (or undefined) per team value, in the container the values came in. Call after the league is loaded. */
export function teamColorsSync<T extends Value | readonly Value[]>(
  league: League,
  teams: T,
  opts: ColorOptions = {},
): ColorResult<T> {
  const col = column(opts.which ?? "primary");
  checkLeague(league);
  const colors = colorMap(league, col);
  const ids = resolveSync(teams, league, opts) as Resolved<T>;
  const pick = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : colors.get(id);
  return (
    Array.isArray(ids) ? (ids as (string | undefined)[]).map(pick) : pick(ids as string | undefined)
  ) as ColorResult<T>;
}

export async function teamColors<T extends Value | readonly Value[]>(
  league: League,
  teams: T,
  opts: ColorOptions = {},
): Promise<ColorResult<T>> {
  await loadLeague(league);
  return teamColorsSync(league, teams, opts);
}
