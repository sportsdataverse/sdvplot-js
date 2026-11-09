import {
  INDEX_FIRST_SEASON,
  INDEX_LAST_ALIAS_SEASON,
  LEAGUES,
  LEAGUE_META,
  type League,
  type LeagueData,
  type Team,
  loaders,
} from "./data/index.js";
import { InputError } from "./errors.js";
import { loadGsis } from "./headshots.js";

const loaded = new Map<League, LeagueData>();
const pending = new Map<League, Promise<LeagueData>>();
const allRows = new Map<League, readonly Team[]>();

/**
 * Python `_index.NON_TEAM`: the `program` of the conference and league rows (and the NHL's division marks). Every team
 * listing leaves them out unless asked (`teams(league, { includeConferences: true })`); a null program (soccer) is a team.
 */
const NON_TEAM: readonly string[] = ["conference", "league", "division"];
const isTeam = (t: Team): boolean => t.program === null || !NON_TEAM.includes(t.program);

export function checkLeague(league: string): asserts league is League {
  if (!(LEAGUES as readonly string[]).includes(league))
    throw new InputError(`unknown league ${JSON.stringify(league)}; known leagues: ${LEAGUES.join(", ")}`);
}
/**
 * Load a league's bundled teams, aliases and marks (one code-split chunk; nothing is downloaded). Every `*Sync`
 * function needs it first. Async throughout: an unknown league rejects (never throws synchronously); a failed chunk
 * load can be retried.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 *
 * const nfl = await loadLeague("nfl");
 * nfl.teams.find((t) => t.abbr === "KC");
 * ```
 */
export async function loadLeague(league: League): Promise<LeagueData> {
  checkLeague(league);
  const hit = loaded.get(league);
  if (hit) return hit;
  let p = pending.get(league);
  if (!p) {
    p = loaders[league]().then(
      (raw) => {
        // Python `_index.team_table`: the rows palettes, colours, tables and every team listing read
        const d = raw.teams.every(isTeam) ? raw : { ...raw, teams: raw.teams.filter(isTeam) };
        allRows.set(league, raw.teams);
        loaded.set(league, d);
        pending.delete(league);
        return d;
      },
      (e: unknown) => {
        pending.delete(league);
        throw e;
      },
    );
    pending.set(league, p);
  }
  return p;
}
/** Every league shard plus the gsis map, so every *Sync variant works afterwards. */
export async function preloadAll(): Promise<void> {
  await Promise.all([...LEAGUES.map(loadLeague), loadGsis()]);
}
export function getLeagueSync(league: League): LeagueData {
  checkLeague(league);
  const d = loaded.get(league);
  if (!d)
    throw new InputError(
      `league ${league} is not loaded; await loadLeague("${league}") or preloadAll() before calling the *Sync variant`,
    );
  return d;
}
/** Every index row of a loaded league, its conference and league rows included (Python `teams(include_conferences=True)`). */
export function leagueRowsSync(league: League): readonly Team[] {
  getLeagueSync(league);
  return allRows.get(league) as readonly Team[];
}
/** Port of `_index.season_bounds`: [first, last]; last = max(latest alias season, next year). */
export function seasonBounds(league?: League): readonly [number, number] | null {
  if (INDEX_FIRST_SEASON === null || INDEX_LAST_ALIAS_SEASON === null) return null;
  const last = Math.max(INDEX_LAST_ALIAS_SEASON, new Date().getFullYear() + 1);
  const first = league ? (LEAGUE_META[league].firstSeason ?? INDEX_FIRST_SEASON) : INDEX_FIRST_SEASON;
  return [first, last];
}
/**
 * The latest season any dated alias of `league` names (the last relocation or rename the index records), or `null`
 * when no alias is dated. It is not the current season: the NHL's is 1997. A value resolved without a season is
 * matched at this season first.
 */
export const latestSeason = (league: League): number | null => LEAGUE_META[league].latestSeason;
