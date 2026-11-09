import { LEAGUES, type League, type Team } from "./data/index.js";
import { leagueRowsSync, loadLeague, preloadAll } from "./index-data.js";

/** Options of `teams`. */
export interface TeamsOptions {
  /**
   * Also list the conference and league rows (`program` `"conference"` or `"league"`; Python's and sdvplotR's
   * `include_conferences`). The default, false, lists teams only, as palettes, colours and every other team listing do.
   */
  includeConferences?: boolean;
}

/**
 * All teams for one league, or every league (in `LEAGUES` order) when omitted.
 *
 * @example
 * ```ts
 * import { teams } from "@sportsdataverse/sdvplot";
 *
 * await teams("cfb", { includeConferences: true });
 * ```
 */
export async function teams(league?: League, opts: TeamsOptions = {}): Promise<readonly Team[]> {
  const rows = async (lg: League): Promise<readonly Team[]> => {
    const d = await loadLeague(lg);
    return opts.includeConferences ? leagueRowsSync(lg) : d.teams;
  };
  if (league) return rows(league);
  await preloadAll();
  return (await Promise.all(LEAGUES.map(rows))).flat();
}
