// Real 2026 NBA shots (spec §7), from fixtures/shots (provenance: fixtures/shots/README.md). JSON imports, no
// node:fs, so the examples registry can re-export these rows to the browser too.
import columns from "../../../../fixtures/shots/nba-2026-bkn-2000-columns.json" with { type: "json" };
import games from "../../../../fixtures/shots/nba-2026-bkn-games.json" with { type: "json" };
import square from "../../../../fixtures/shots/nba-2026-league-square.json" with { type: "json" };
import league from "../../../../fixtures/shots/nba-2026-league.json" with { type: "json" };
import type { DistanceBin, LeagueIndex, ShotRow, SideBin } from "../../src/shots/index.js";

/** A shot with its game: `game_id` is stats.nba.com's 10-character string id ("0022500031"), as in BKN_GAMES. */
export interface BknShot extends ShotRow {
  readonly game_id: string;
}
/** The 2000 BKN shots of blazing-the-nets' own fixture (first 2000 BKN rows of shots_2026.parquet), as release rows. */
export const BKN: readonly BknShot[] = columns.x_legacy.map((x, i) => ({
  game_id: columns.game_id[i] as string,
  x_legacy: x,
  y_legacy: columns.y_legacy[i] as number,
  shot_distance: columns.shot_distance[i] as number,
  shot_value: columns.shot_value[i] as number,
  shot_result: columns.made[i] === 1 ? "Made" : "Missed",
}));

export interface BknGame {
  readonly game_id: string;
  /** `YYYY-MM-DD`. */
  readonly game_date: string;
  /** `"BKN @ CHA"` (away) or `"BKN vs. CLE"` (home). */
  readonly matchup: string;
  /** `"W"` or `"L"`. */
  readonly wl: string;
}
/** The 24 games of BKN's shots: Brooklyn's rows of blazing-the-nets' test/fixtures/game_logs_2026_bkn.parquet, by date. */
export const BKN_GAMES: readonly BknGame[] = games.games;

/** The committed indexes keep blazing-the-nets' key, `hexes` (byte-identical tool output); `LeagueIndex` says `cells`. */
const index = <T extends { readonly hexes: unknown }>({ hexes, ...lattice }: T) => ({
  ...lattice,
  cells: hexes,
});

export interface LeagueFixture {
  readonly byFoot: readonly DistanceBin[];
  readonly byBin3: readonly DistanceBin[];
  readonly sides3: readonly SideBin[];
  readonly hex10: LeagueIndex;
  readonly hex15: LeagueIndex;
}
/** The 2026 regular-season league context, computed by blazing-the-nets' own code (tools/oracle/shots.ts). */
export const LEAGUE: LeagueFixture = {
  byFoot: league.byFoot,
  byBin3: league.byBin3,
  sides3: league.sides3,
  hex10: index(league.hex10) as LeagueIndex,
  hex15: index(league.hex15) as LeagueIndex,
};

/**
 * The same league on squares of a radius-10 hexagon's area, binned by sdvplot's OWN squarebin: context data, not an
 * oracle (J38 S16; fixtures/shots/README.md).
 */
export const LEAGUE_SQUARE: LeagueIndex = index(square.square10) as LeagueIndex;
