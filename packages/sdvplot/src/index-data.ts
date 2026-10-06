import {
  INDEX_FIRST_SEASON,
  INDEX_LAST_ALIAS_SEASON,
  LEAGUES,
  LEAGUE_META,
  type League,
  type LeagueData,
  loaders,
} from "./data/index.js";
import { InputError } from "./errors.js";

const loaded = new Map<League, LeagueData>();
const pending = new Map<League, Promise<LeagueData>>();

export function checkLeague(league: string): asserts league is League {
  if (!(LEAGUES as readonly string[]).includes(league))
    throw new InputError(`unknown league ${JSON.stringify(league)}; known leagues: ${LEAGUES.join(", ")}`);
}
export function loadLeague(league: League): Promise<LeagueData> {
  checkLeague(league);
  const hit = loaded.get(league);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(league);
  if (!p) {
    p = loaders[league]().then((d) => {
      loaded.set(league, d);
      pending.delete(league);
      return d;
    });
    pending.set(league, p);
  }
  return p;
}
export async function preloadAll(): Promise<void> {
  await Promise.all(LEAGUES.map(loadLeague));
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
/** Port of `_index.season_bounds`: [first, last]; last = max(latest alias season, next year). */
export function seasonBounds(league?: League): readonly [number, number] | null {
  if (INDEX_FIRST_SEASON === null || INDEX_LAST_ALIAS_SEASON === null) return null;
  const last = Math.max(INDEX_LAST_ALIAS_SEASON, new Date().getFullYear() + 1);
  const first = league ? (LEAGUE_META[league].firstSeason ?? INDEX_FIRST_SEASON) : INDEX_FIRST_SEASON;
  return [first, last];
}
export const latestSeason = (league: League): number | null => LEAGUE_META[league].latestSeason;
