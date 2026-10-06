import { LEAGUES, type League, type Team } from "./data/index.js";
import { loadLeague, preloadAll } from "./index-data.js";

/** All teams for one league, or every league (in `LEAGUES` order) when omitted. */
export async function teams(league?: League): Promise<readonly Team[]> {
  if (league) return (await loadLeague(league)).teams;
  await preloadAll();
  return (await Promise.all(LEAGUES.map(loadLeague))).flatMap((d) => d.teams);
}
