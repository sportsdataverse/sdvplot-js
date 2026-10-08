// Real 2026 NBA shots (spec §7), from fixtures/shots (provenance: fixtures/shots/README.md). JSON imports, no
// node:fs, so the examples registry can re-export these rows to the browser too.
import columns from "../../../../fixtures/shots/nba-2026-bkn-2000-columns.json" with { type: "json" };
import square from "../../../../fixtures/shots/nba-2026-league-square.json" with { type: "json" };
import league from "../../../../fixtures/shots/nba-2026-league.json" with { type: "json" };
import type { DistanceBin, LeagueIndex, ShotRow, SideBin } from "../../src/shots/index.js";

/** The 2000 BKN shots of blazing-the-nets' own fixture (first 2000 BKN rows of shots_2026.parquet), as release rows. */
export const BKN: readonly ShotRow[] = columns.x_legacy.map((x, i) => ({
  x_legacy: x,
  y_legacy: columns.y_legacy[i] as number,
  shot_distance: columns.shot_distance[i] as number,
  shot_value: columns.shot_value[i] as number,
  shot_result: columns.made[i] === 1 ? "Made" : "Missed",
}));

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
