// src/team-name.ts — sdvplot exports no sync name lookup (getLeagueSync is internal), so prepare() caches the names once.
import type { League } from "@sportsdataverse/sdvplot";
import { loadLeague } from "@sportsdataverse/sdvplot";

const NAMES = new Map<string, string>();
export async function loadTeamNames(leagues: readonly League[]): Promise<void> {
  await Promise.all(
    leagues.map(async (l) => {
      for (const t of (await loadLeague(l)).teams) if (t.name) NAMES.set(`${l}:${t.team_id}`, t.name);
    }),
  );
}
/** The team's name after prepare(); undefined before (alt text then falls back to the cell value). */
export function teamNameSync(league: League, teamId: string): string | undefined {
  return NAMES.get(`${league}:${teamId}`);
}
