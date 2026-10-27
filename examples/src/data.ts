/**
 * Real sample rows the examples share (spec §7: real fixtures, never synthetic). Examples import them as
 * `@sportsdataverse/examples/data`; the "Sample data" page prints them.
 */
export { STANDINGS } from "../../packages/sdvtables/test/fixtures/standings.js";
export type { Standing } from "../../packages/sdvtables/test/fixtures/standings.js";

/**
 * Brooklyn's 2025-26 shots and that season's league context, as `sdvplot/shots` reads them. BKN_SHOTS_2026: the first
 * 2000 Brooklyn rows of the sportsdataverse-data `nba_stats_shots` release (`shots_2026.parquet`), as release rows
 * (`game_id`, `x_legacy`/`y_legacy` in tenths of a foot from the hoop, `shot_distance`, `shot_value`, `shot_result`).
 * NBA_LEAGUE_2026: the 219,159 regular-season shots of the same release by foot, by 3 ft, by side and in radius-10 and
 * radius-15 hexagons, computed by blazing-the-nets' own code. NBA_LEAGUE_SQUARE_2026: the same shots in squares of a
 * radius-10 hexagon's area, binned by sdvplot's `squarebin` (context data, not an oracle). Provenance, hashes and the
 * command: fixtures/shots/README.md.
 */
export {
  BKN as BKN_SHOTS_2026,
  LEAGUE as NBA_LEAGUE_2026,
  LEAGUE_SQUARE as NBA_LEAGUE_SQUARE_2026,
} from "../../packages/sdvplot/test/shots/fixture.js";

/**
 * Super Bowl LIX (Kansas City at Philadelphia, 2025-02-09; PHI won 40-22): ESPN's home (PHI) win probability after
 * each of 186 plays, against minutes played (the play's start clock). Real: ESPN Site v2 `summary?event=401671889`,
 * `winprobability` joined to `drives.previous[].plays[]` by `playId` (one pregame row has no play), as captured in
 * sportsdataverse-py `tests/fixtures/espn/summary_nfl.json`, trimmed to
 * fixtures/examples/espn_nfl_summary_401671889_wp.json; examples/test/sample-data.test.ts rebuilds these rows from it.
 */
export const SUPER_BOWL_LIX_WP: readonly { readonly minute: number; readonly home_wp: number }[] = (
  [
    [0, 0.5846],
    [0, 0.5809],
    [0.68, 0.5989],
    [1.37, 0.5909],
    [2.05, 0.5615],
    [2.57, 0.5482],
    [3.32, 0.5412],
    [3.42, 0.5548],
    [3.65, 0.5546],
    [3.65, 0.5408],
    [4.32, 0.5564],
    [4.88, 0.5673],
    [4.95, 0.5884],
    [5.13, 0.582],
    [5.33, 0.5819],
    [5.33, 0.5691],
    [5.93, 0.611],
    [6.5, 0.6008],
    [7.08, 0.5932],
    [7.6, 0.6423],
    [7.67, 0.6159],
    [8.38, 0.6938],
    [8.47, 0.6937],
    [8.75, 0.7114],
    [8.75, 0.7002],
    [8.87, 0.6982],
    [9.52, 0.7014],
    [10.18, 0.738],
    [10.27, 0.7347],
    [10.4, 0.7348],
    [10.4, 0.7174],
    [10.53, 0.714],
    [11.22, 0.7471],
    [11.67, 0.7636],
    [12.2, 0.7823],
    [12.68, 0.7787],
    [13.15, 0.7767],
    [13.8, 0.7746],
    [14.35, 0.793],
    [14.87, 0.7629],
    [15, 0.763],
    [15, 0.7684],
    [15.65, 0.7375],
    [15.75, 0.7376],
    [15.75, 0.7516],
    [16.37, 0.7429],
    [17.12, 0.7726],
    [17.17, 0.7626],
    [17.38, 0.7626],
    [17.38, 0.7432],
    [18.07, 0.7455],
    [18.82, 0.7934],
    [19.2, 0.7866],
    [19.75, 0.7903],
    [20.43, 0.7671],
    [21.3, 0.7637],
    [21.3, 0.7558],
    [21.37, 0.7867],
    [21.37, 0.8176],
    [21.37, 0.7778],
    [21.37, 0.8014],
    [22.03, 0.8129],
    [22.95, 0.9087],
    [22.95, 0.9267],
    [22.95, 0.9038],
    [22.95, 0.9145],
    [23.55, 0.9158],
    [24.23, 0.9291],
    [25.05, 0.9306],
    [25.18, 0.9308],
    [25.18, 0.9382],
    [25.67, 0.9368],
    [26.42, 0.9223],
    [26.88, 0.916],
    [27.53, 0.9404],
    [27.58, 0.9323],
    [27.75, 0.9338],
    [27.75, 0.9401],
    [28, 0.9407],
    [28, 0.9231],
    [28.07, 0.9329],
    [28.18, 0.9647],
    [28.25, 0.9599],
    [28.33, 0.9614],
    [28.42, 0.9758],
    [28.42, 0.9815],
    [28.42, 0.9737],
    [28.42, 0.9801],
    [28.55, 0.9808],
    [28.62, 0.9784],
    [29.33, 0.9802],
    [29.43, 0.9812],
    [29.58, 0.9808],
    [30, 0.9836],
    [30, 0.977],
    [30, 0.9746],
    [30.35, 0.9743],
    [30.7, 0.9783],
    [31.37, 0.9836],
    [32.13, 0.9844],
    [32.85, 0.9854],
    [33, 0.9856],
    [33, 0.985],
    [33.62, 0.9849],
    [34.3, 0.9895],
    [35.03, 0.9906],
    [35.62, 0.9922],
    [36.32, 0.9929],
    [37.03, 0.9951],
    [37.57, 0.9968],
    [38.22, 0.9962],
    [38.93, 0.9966],
    [38.93, 0.9959],
    [39.18, 0.996],
    [39.18, 0.996],
    [39.48, 0.9949],
    [39.63, 0.9949],
    [39.7, 0.9955],
    [39.7, 0.9981],
    [39.7, 0.9949],
    [39.7, 0.9944],
    [40.03, 0.9941],
    [40.58, 0.9966],
    [40.93, 0.9972],
    [41.47, 0.9978],
    [42.17, 0.999],
    [42.22, 0.999],
    [42.33, 0.9986],
    [42.33, 0.999],
    [42.45, 0.9977],
    [42.95, 0.9982],
    [43.03, 0.9985],
    [43.58, 0.9973],
    [44.43, 0.999],
    [44.43, 0.999],
    [44.52, 0.999],
    [45, 0.999],
    [45, 0.999],
    [45.65, 0.999],
    [46.38, 0.999],
    [47.07, 0.999],
    [47.78, 0.999],
    [48.52, 0.999],
    [49.25, 0.999],
    [50, 0.999],
    [50.07, 0.999],
    [50.15, 0.999],
    [50.15, 0.999],
    [50.15, 0.999],
    [50.15, 0.999],
    [50.3, 0.999],
    [51.03, 0.999],
    [51.78, 0.999],
    [51.78, 0.999],
    [51.92, 0.999],
    [51.92, 0.999],
    [51.98, 0.999],
    [51.98, 0.999],
    [51.98, 0.999],
    [52.1, 0.999],
    [52.72, 0.999],
    [53.23, 0.999],
    [53.67, 0.999],
    [53.93, 0.999],
    [54.5, 0.999],
    [54.57, 0.999],
    [54.92, 0.999],
    [55.42, 0.999],
    [56.02, 0.999],
    [56.12, 0.999],
    [56.2, 0.999],
    [56.28, 0.999],
    [57.1, 0.999],
    [57.1, 0.999],
    [57.13, 0.999],
    [57.22, 0.999],
    [57.22, 0.999],
    [57.92, 0.999],
    [58.02, 0.999],
    [58.02, 0.999],
    [58.2, 0.999],
    [58.2, 0.999],
    [58.22, 0.999],
    [58.92, 0.999],
    [59.55, 0.999],
    [60, 1],
  ] satisfies [number, number][]
).map(([minute, home_wp]) => ({ minute, home_wp }));

/** One shot from stats.nba.com `shotchartdetail`, its columns renamed (LOC_X/LOC_Y become the nba-legacy frame's names). */
// a type, not an interface: toSurfaceFrame takes rows with an index signature, which only a type literal satisfies
export type NbaShot = {
  readonly game_event_id: number;
  readonly player: string;
  readonly team: "DEN" | "LAL";
  readonly shot_type: "2PT Field Goal" | "3PT Field Goal";
  readonly made: boolean;
  /** LOC_X: tenths of a foot from the hoop, across the court. */
  readonly x_legacy: number;
  /** LOC_Y: tenths of a foot from the hoop, toward half court. */
  readonly y_legacy: number;
};
/**
 * Every field-goal attempt of the fourth quarter of the Lakers at the Nuggets, 24 October 2023 (game 0022300061,
 * opening night of 2023-24; Denver won 119-107): 38 shots, 22 Denver and 16 Los Angeles. Real: stats.nba.com
 * `shotchartdetail` (GameID 0022300061, PlayerID 0, TeamID 0, ContextMeasure FGA), captured 2026-10-08 and committed as
 * fixtures/examples/nba_shotchartdetail_0022300061_q4.json; examples/test/sample-data.test.ts checks these rows equal it.
 */
// biome-ignore format: one captured shot per line
export const NBA_SHOTS: readonly NbaShot[] = [
  { game_event_id: 495, player: "LeBron James", team: "LAL", shot_type: "2PT Field Goal", made: true, x_legacy: 29, y_legacy: 5 },
  { game_event_id: 498, player: "Reggie Jackson", team: "DEN", shot_type: "2PT Field Goal", made: false, x_legacy: 126, y_legacy: 147 },
  { game_event_id: 500, player: "Christian Wood", team: "LAL", shot_type: "2PT Field Goal", made: true, x_legacy: -12, y_legacy: 13 },
  { game_event_id: 502, player: "Aaron Gordon", team: "DEN", shot_type: "3PT Field Goal", made: true, x_legacy: 227, y_legacy: 109 },
  { game_event_id: 504, player: "D'Angelo Russell", team: "LAL", shot_type: "3PT Field Goal", made: false, x_legacy: 0, y_legacy: 267 },
  { game_event_id: 506, player: "Cam Reddish", team: "LAL", shot_type: "2PT Field Goal", made: false, x_legacy: 22, y_legacy: 12 },
  { game_event_id: 508, player: "Cam Reddish", team: "LAL", shot_type: "2PT Field Goal", made: true, x_legacy: 0, y_legacy: 0 },
  { game_event_id: 509, player: "Jamal Murray", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 118, y_legacy: 132 },
  { game_event_id: 510, player: "LeBron James", team: "LAL", shot_type: "3PT Field Goal", made: true, x_legacy: -53, y_legacy: 285 },
  { game_event_id: 512, player: "Christian Braun", team: "DEN", shot_type: "3PT Field Goal", made: false, x_legacy: 15, y_legacy: 253 },
  { game_event_id: 514, player: "Christian Braun", team: "DEN", shot_type: "2PT Field Goal", made: false, x_legacy: -21, y_legacy: 10 },
  { game_event_id: 516, player: "Christian Braun", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 0, y_legacy: 0 },
  { game_event_id: 528, player: "Anthony Davis", team: "LAL", shot_type: "3PT Field Goal", made: false, x_legacy: -116, y_legacy: 239 },
  { game_event_id: 530, player: "Nikola Jokić", team: "DEN", shot_type: "3PT Field Goal", made: true, x_legacy: -136, y_legacy: 214 },
  { game_event_id: 541, player: "Gabe Vincent", team: "LAL", shot_type: "2PT Field Goal", made: false, x_legacy: 33, y_legacy: 12 },
  { game_event_id: 543, player: "Kentavious Caldwell-Pope", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 104, y_legacy: 152 },
  { game_event_id: 546, player: "Nikola Jokić", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 62, y_legacy: 150 },
  { game_event_id: 548, player: "Gabe Vincent", team: "LAL", shot_type: "3PT Field Goal", made: false, x_legacy: -170, y_legacy: 196 },
  { game_event_id: 550, player: "Christian Braun", team: "DEN", shot_type: "2PT Field Goal", made: false, x_legacy: -20, y_legacy: 6 },
  { game_event_id: 566, player: "Christian Braun", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: -32, y_legacy: 6 },
  { game_event_id: 574, player: "Austin Reaves", team: "LAL", shot_type: "3PT Field Goal", made: false, x_legacy: -161, y_legacy: 242 },
  { game_event_id: 576, player: "Jamal Murray", team: "DEN", shot_type: "2PT Field Goal", made: false, x_legacy: 25, y_legacy: 13 },
  { game_event_id: 578, player: "Taurean Prince", team: "LAL", shot_type: "3PT Field Goal", made: true, x_legacy: 161, y_legacy: 190 },
  { game_event_id: 581, player: "LeBron James", team: "LAL", shot_type: "2PT Field Goal", made: true, x_legacy: -31, y_legacy: 15 },
  { game_event_id: 585, player: "Jamal Murray", team: "DEN", shot_type: "3PT Field Goal", made: true, x_legacy: 76, y_legacy: 248 },
  { game_event_id: 587, player: "LeBron James", team: "LAL", shot_type: "3PT Field Goal", made: false, x_legacy: 151, y_legacy: 210 },
  { game_event_id: 590, player: "Kentavious Caldwell-Pope", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: -112, y_legacy: 161 },
  { game_event_id: 594, player: "Aaron Gordon", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 2, y_legacy: 1 },
  { game_event_id: 596, player: "Austin Reaves", team: "LAL", shot_type: "3PT Field Goal", made: true, x_legacy: 4, y_legacy: 278 },
  { game_event_id: 598, player: "Michael Porter Jr.", team: "DEN", shot_type: "3PT Field Goal", made: true, x_legacy: 234, y_legacy: 27 },
  { game_event_id: 601, player: "LeBron James", team: "LAL", shot_type: "2PT Field Goal", made: true, x_legacy: -25, y_legacy: 16 },
  { game_event_id: 608, player: "Nikola Jokić", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: -2, y_legacy: 21 },
  { game_event_id: 625, player: "Aaron Gordon", team: "DEN", shot_type: "2PT Field Goal", made: false, x_legacy: -88, y_legacy: 16 },
  { game_event_id: 629, player: "Michael Porter Jr.", team: "DEN", shot_type: "3PT Field Goal", made: false, x_legacy: -207, y_legacy: 135 },
  { game_event_id: 646, player: "Nikola Jokić", team: "DEN", shot_type: "3PT Field Goal", made: false, x_legacy: -54, y_legacy: 247 },
  { game_event_id: 648, player: "Michael Porter Jr.", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 0, y_legacy: 0 },
  { game_event_id: 649, player: "Gabe Vincent", team: "LAL", shot_type: "2PT Field Goal", made: true, x_legacy: -26, y_legacy: 16 },
  { game_event_id: 662, player: "Jalen Pickett", team: "DEN", shot_type: "2PT Field Goal", made: true, x_legacy: 88, y_legacy: 143 },
];

/** One NBA team's regular-season record from stats.nba.com `leaguestandingsv3`, its columns renamed. */
export type NbaStanding = {
  /** TeamID */
  readonly team_id: number;
  /** TeamCity */
  readonly city: string;
  /** TeamName: the nickname, which sdvplot resolves. */
  readonly team: string;
  /** WINS */
  readonly wins: number;
  /** LOSSES */
  readonly losses: number;
  /** DivisionRank */
  readonly division_rank: number;
};
/**
 * The Pacific Division's final 2023-24 regular-season standings (the season of NBA_SHOTS). Real: stats.nba.com
 * `leaguestandingsv3` (Season 2023-24, Regular Season) as committed in sportsdataverse-py
 * `tests/fixtures/nba_stats/leaguestandingsv3_2023_24.json` (captured 2026-07-08), trimmed to its 5 Pacific rows in
 * fixtures/examples/nba_leaguestandingsv3_2023_24_pacific.json; examples/test/sample-data.test.ts checks these rows
 * equal it.
 */
// biome-ignore format: one captured row per line
export const NBA_STANDINGS: readonly NbaStanding[] = [
  { team_id: 1610612746, city: "LA", team: "Clippers", wins: 51, losses: 31, division_rank: 1 },
  { team_id: 1610612756, city: "Phoenix", team: "Suns", wins: 49, losses: 33, division_rank: 2 },
  { team_id: 1610612747, city: "Los Angeles", team: "Lakers", wins: 47, losses: 35, division_rank: 3 },
  { team_id: 1610612758, city: "Sacramento", team: "Kings", wins: 46, losses: 36, division_rank: 4 },
  { team_id: 1610612744, city: "Golden State", team: "Warriors", wins: 46, losses: 36, division_rank: 5 },
];

/** One NHL team's regular-season record from NHL api-web `/standings/now`, its columns renamed. */
export type NhlStanding = {
  /** teamAbbrev.default */
  readonly team: string;
  readonly wins: number;
  readonly losses: number;
  /** otLosses */
  readonly ot_losses: number;
  readonly points: number;
  /** divisionSequence */
  readonly division_rank: number;
};
/**
 * The Atlantic Division's final 2025-26 regular-season standings (82 games each; the rows are dated 2026-04-17). Real:
 * NHL api-web `/v1/standings/now` as committed in sportsdataverse-py `tests/fixtures/nhl_api_web/standings_now.json`
 * (captured 2026-05-24), trimmed to its 8 Atlantic rows in fixtures/examples/nhl_standings_20252026_atlantic.json;
 * examples/test/sample-data.test.ts checks these rows equal it.
 */
// biome-ignore format: one captured row per line
export const NHL_STANDINGS: readonly NhlStanding[] = [
  { team: "BUF", wins: 50, losses: 23, ot_losses: 9, points: 109, division_rank: 1 },
  { team: "TBL", wins: 50, losses: 26, ot_losses: 6, points: 106, division_rank: 2 },
  { team: "MTL", wins: 48, losses: 24, ot_losses: 10, points: 106, division_rank: 3 },
  { team: "BOS", wins: 45, losses: 27, ot_losses: 10, points: 100, division_rank: 4 },
  { team: "OTT", wins: 44, losses: 27, ot_losses: 11, points: 99, division_rank: 5 },
  { team: "DET", wins: 41, losses: 31, ot_losses: 10, points: 92, division_rank: 6 },
  { team: "FLA", wins: 40, losses: 38, ot_losses: 4, points: 84, division_rank: 7 },
  { team: "TOR", wins: 32, losses: 36, ot_losses: 14, points: 78, division_rank: 8 },
];

/** One NHL shot from NHL api-web play-by-play, its columns renamed. */
export type NhlShot = {
  /** eventId */
  readonly event_id: number;
  /** typeDescKey */
  readonly type: "goal" | "shot-on-goal" | "missed-shot";
  /** timeInPeriod */
  readonly time: string;
  /** the abbreviation of details.eventOwnerTeamId, from the game's homeTeam/awayTeam */
  readonly team: "EDM" | "FLA";
  /** details.xCoord: feet from centre ice along the rink, the frame sporty's NHL rink is drawn in. */
  readonly x: number;
  /** details.yCoord: feet from centre ice across the rink. */
  readonly y: number;
};
/**
 * Every shot of the first period of game 7 of the 2024 Stanley Cup Final (Edmonton at Florida, 24 June 2024, game
 * 2023030417; Florida won 2-1), goals, shots on goal and misses: 27 shots, 11 by Edmonton and 16 by Florida. In that
 * period Florida shot at the -x end and Edmonton at the +x end. Real: NHL api-web
 * `/v1/gamecenter/2023030417/play-by-play` as committed in sportsdataverse-py
 * `tests/fixtures/nhl_api_web/pbp_2024_scf_g7.json` (captured 2026-05-24), trimmed in
 * fixtures/examples/nhl_pbp_2023030417_p1_shots.json; examples/test/sample-data.test.ts checks these rows equal it.
 */
// biome-ignore format: one captured shot per line
export const NHL_SHOTS: readonly NhlShot[] = [
  { event_id: 251, type: "shot-on-goal", time: "00:21", team: "EDM", x: 82, y: -3 },
  { event_id: 55, type: "missed-shot", time: "00:31", team: "FLA", x: -81, y: 30 },
  { event_id: 81, type: "shot-on-goal", time: "02:20", team: "EDM", x: 64, y: 4 },
  { event_id: 90, type: "shot-on-goal", time: "02:31", team: "FLA", x: -69, y: 31 },
  { event_id: 302, type: "goal", time: "04:27", team: "FLA", x: -83, y: -6 },
  { event_id: 186, type: "goal", time: "06:44", team: "EDM", x: 77, y: -2 },
  { event_id: 191, type: "shot-on-goal", time: "07:00", team: "FLA", x: -75, y: 19 },
  { event_id: 303, type: "missed-shot", time: "07:09", team: "FLA", x: -45, y: -25 },
  { event_id: 202, type: "missed-shot", time: "07:19", team: "FLA", x: -34, y: -26 },
  { event_id: 402, type: "missed-shot", time: "07:56", team: "FLA", x: -78, y: 4 },
  { event_id: 405, type: "shot-on-goal", time: "08:09", team: "FLA", x: -32, y: -22 },
  { event_id: 414, type: "missed-shot", time: "09:14", team: "FLA", x: -31, y: -19 },
  { event_id: 423, type: "missed-shot", time: "10:09", team: "EDM", x: 28, y: 31 },
  { event_id: 426, type: "shot-on-goal", time: "10:24", team: "EDM", x: 34, y: 6 },
  { event_id: 428, type: "missed-shot", time: "10:49", team: "EDM", x: 32, y: -9 },
  { event_id: 450, type: "missed-shot", time: "13:06", team: "EDM", x: 45, y: -11 },
  { event_id: 306, type: "missed-shot", time: "13:18", team: "EDM", x: 38, y: 16 },
  { event_id: 460, type: "shot-on-goal", time: "14:36", team: "EDM", x: 85, y: 25 },
  { event_id: 465, type: "shot-on-goal", time: "14:56", team: "EDM", x: 94, y: -9 },
  { event_id: 471, type: "missed-shot", time: "15:01", team: "EDM", x: 48, y: -39 },
  { event_id: 472, type: "missed-shot", time: "15:21", team: "FLA", x: -56, y: 15 },
  { event_id: 473, type: "missed-shot", time: "15:35", team: "FLA", x: -29, y: 32 },
  { event_id: 482, type: "shot-on-goal", time: "16:25", team: "FLA", x: -46, y: -22 },
  { event_id: 486, type: "shot-on-goal", time: "16:36", team: "FLA", x: -35, y: -37 },
  { event_id: 496, type: "shot-on-goal", time: "17:45", team: "FLA", x: -61, y: 14 },
  { event_id: 655, type: "missed-shot", time: "18:41", team: "FLA", x: -84, y: 8 },
  { event_id: 671, type: "missed-shot", time: "19:50", team: "FLA", x: -71, y: 32 },
];

/** One ESPN play from an NFL game summary, its fields renamed. */
export type NflPlay = {
  /** id */
  readonly play_id: string;
  /** period.number */
  readonly period: number;
  /** clock.displayValue */
  readonly clock: string;
  /** type.text */
  readonly type: "Rushing Touchdown" | "Passing Touchdown";
  /** the offence: the abbreviation of start.team.id, from the header's competitors */
  readonly team: "KC" | "PHI";
  /** start.yardLine: the line of scrimmage, 0-100 from Philadelphia's (the home team's) goal line. */
  readonly yardline: number;
};
/**
 * Super Bowl LIX's six offensive touchdowns (Kansas City at Philadelphia, 2025-02-09; the same game as
 * SUPER_BOWL_LIX_WP), three each, with the line of scrimmage each scoring play started from. ESPN reports no lateral
 * position for a play. Real: ESPN Site v2 `summary?event=401671889` as committed in sportsdataverse-py
 * `tests/fixtures/espn/summary_nfl.json`, trimmed to the Rushing and Passing Touchdown plays in
 * fixtures/examples/espn_nfl_summary_401671889_offense_tds.json; examples/test/sample-data.test.ts checks these rows
 * equal it.
 */
// biome-ignore format: one captured play per line
export const SUPER_BOWL_LIX_TDS: readonly NflPlay[] = [
  { play_id: "401671889594", period: 1, clock: "6:15", type: "Rushing Touchdown", team: "PHI", yardline: 99 },
  { play_id: "4016718891935", period: 2, clock: "1:35", type: "Passing Touchdown", team: "PHI", yardline: 88 },
  { play_id: "4016718892858", period: 3, clock: "2:40", type: "Passing Touchdown", team: "PHI", yardline: 54 },
  { play_id: "4016718893030", period: 3, clock: "0:34", type: "Passing Touchdown", team: "KC", yardline: 24 },
  { play_id: "4016718893932", period: 4, clock: "2:54", type: "Passing Touchdown", team: "KC", yardline: 7 },
  { play_id: "4016718894124", period: 4, clock: "1:48", type: "Passing Touchdown", team: "KC", yardline: 50 },
];

/** One PWHL goal from HockeyTech `gameCenterPlayByPlay`, its fields renamed. */
export type PwhlGoal = {
  /** details.game_goal_id */
  readonly goal_id: string;
  /** details.team.abbreviation */
  readonly team: "BOS" | "MTL";
  /** details.period.id, as a number */
  readonly period: number;
  /** details.time */
  readonly time: string;
  /** details.scoredBy first and last name */
  readonly scorer: string;
  /** details.xLocation: pixels from the left of HockeyTech's 600 x 300 canvas. */
  readonly x: number;
  /** details.yLocation: pixels down from the top of the canvas. */
  readonly y: number;
};
/**
 * The four goals of PWHL Boston at PWHL Montreal, 2 March 2024 (game 42 of the league's first season; Montreal won
 * 3-1). Real: HockeyTech `statviewfeed/gameCenterPlayByPlay` (game_id 42) as committed in sportsdataverse-py
 * `tests/fixtures/hockeytech/pwhl_pbp_42.json`, trimmed to its 70 shot and goal events in
 * fixtures/examples/pwhl_pbp_42_shots.json; examples/test/sample-data.test.ts checks these rows equal its goals.
 */
// biome-ignore format: one captured goal per line
export const PWHL_GOALS: readonly PwhlGoal[] = [
  { goal_id: "253", team: "MTL", period: 1, time: "3:51", scorer: "Marie-Philip Poulin", x: 90, y: 123 },
  { goal_id: "258", team: "MTL", period: 2, time: "4:50", scorer: "Mélodie Daoust", x: 57, y: 105 },
  { goal_id: "259", team: "BOS", period: 2, time: "14:55", scorer: "Hilary Knight", x: 470, y: 117 },
  { goal_id: "262", team: "MTL", period: 3, time: "2:29", scorer: "Erin Ambrose", x: 196, y: 61 },
];
/**
 * Every NFL team's 2024 regular-season EPA: the count and sum over its offensive rush or pass plays and over the plays its
 * defence faced (nflverse play_by_play_2024, `epa` not null), as tools/sample-data/nfl_2024.py wrote them to
 * fixtures/examples/nfl_epa_2024_reg.csv. EPA per play = off_epa / off_plays; net = that minus def_epa / def_plays.
 */
export type NflTeamEpa = {
  readonly team: string;
  readonly off_plays: number;
  readonly off_epa: number;
  readonly def_plays: number;
  readonly def_epa: number;
};
// biome-ignore format: one captured row per line
export const NFL_TEAM_EPA_2024: readonly NflTeamEpa[] = [
  { team: "ARI", off_plays: 1087, off_epa: 73.809165, def_plays: 1070, def_epa: 54.177387 },
  { team: "ATL", off_plays: 1127, off_epa: 46.14526, def_plays: 1097, def_epa: 48.644795 },
  { team: "BAL", off_plays: 1091, off_epa: 215.262498, def_plays: 1121, def_epa: -20.28258 },
  { team: "BUF", off_plays: 1065, off_epa: 199.021083, def_plays: 1095, def_epa: -3.401672 },
  { team: "CAR", off_plays: 1026, off_epa: -41.937003, def_plays: 1195, def_epa: 184.562136 },
  { team: "CHI", off_plays: 1119, off_epa: -83.48176, def_plays: 1055, def_epa: -1.237265 },
  { team: "CIN", off_plays: 1121, off_epa: 119.292182, def_plays: 1120, def_epa: 61.259235 },
  { team: "CLE", off_plays: 1176, off_epa: -206.387941, def_plays: 1051, def_epa: 18.142769 },
  { team: "DAL", off_plays: 1158, off_epa: -103.964276, def_plays: 1083, def_epa: 73.328438 },
  { team: "DEN", off_plays: 1083, off_epa: 10.467473, def_plays: 1143, def_epa: -112.212835 },
  { team: "DET", off_plays: 1125, off_epa: 174.612954, def_plays: 1087, def_epa: -49.044067 },
  { team: "GB", off_plays: 1071, off_epa: 86.105787, def_plays: 1074, def_epa: -72.690398 },
  { team: "HOU", off_plays: 1093, off_epa: -43.192981, def_plays: 1087, def_epa: -58.700021 },
  { team: "IND", off_plays: 1075, off_epa: -50.807559, def_plays: 1139, def_epa: 6.980636 },
  { team: "JAX", off_plays: 1025, off_epa: -22.06423, def_plays: 1175, def_epa: 149.341772 },
  { team: "KC", off_plays: 1124, off_epa: 77.364799, def_plays: 1071, def_epa: 6.16244 },
  { team: "LA", off_plays: 1074, off_epa: 36.402885, def_plays: 1105, def_epa: 54.903476 },
  { team: "LAC", off_plays: 1044, off_epa: 46.996383, def_plays: 1082, def_epa: -60.059686 },
  { team: "LV", off_plays: 1108, off_epa: -145.694045, def_plays: 1086, def_epa: 15.441067 },
  { team: "MIA", off_plays: 1128, off_epa: -45.334382, def_plays: 1048, def_epa: -22.286327 },
  { team: "MIN", off_plays: 1090, off_epa: 40.299129, def_plays: 1125, def_epa: -100.043535 },
  { team: "NE", off_plays: 1082, off_epa: -85.386839, def_plays: 1106, def_epa: 91.822065 },
  { team: "NO", off_plays: 1080, off_epa: -63.456766, def_plays: 1156, def_epa: 41.114773 },
  { team: "NYG", off_plays: 1103, off_epa: -101.204208, def_plays: 1074, def_epa: 75.717242 },
  { team: "NYJ", off_plays: 1063, off_epa: 0.844244, def_plays: 1129, def_epa: 51.806296 },
  { team: "PHI", off_plays: 1129, off_epa: 124.85914, def_plays: 1038, def_epa: -88.769119 },
  { team: "PIT", off_plays: 1110, off_epa: -31.647861, def_plays: 1083, def_epa: -22.688261 },
  { team: "SEA", off_plays: 1083, off_epa: -16.803398, def_plays: 1116, def_epa: -20.323364 },
  { team: "SF", off_plays: 1064, off_epa: 64.535054, def_plays: 1051, def_epa: 54.315427 },
  { team: "TB", off_plays: 1128, off_epa: 148.94236, def_plays: 1104, def_epa: 18.273819 },
  { team: "TEN", off_plays: 1088, off_epa: -110.350422, def_plays: 1043, def_epa: 51.892051 },
  { team: "WAS", off_plays: 1142, off_epa: 159.216485, def_plays: 1073, def_epa: 46.316515 },
];
/** One 2024 regular-season game from nflverse `games.csv` (fixtures/examples/nfl_games_2024_reg.csv). */
export type NflGame = {
  readonly game_id: string;
  readonly week: number;
  readonly away_team: string;
  readonly away_score: number;
  readonly home_team: string;
  readonly home_score: number;
};
/** Every 2024 regular-season game of the Chiefs or the Eagles (34; they did not meet until Super Bowl LIX). */
// biome-ignore format: one captured game per line
export const KC_PHI_GAMES_2024: readonly NflGame[] = [
  { game_id: "2024_01_BAL_KC", week: 1, away_team: "BAL", away_score: 20, home_team: "KC", home_score: 27 },
  { game_id: "2024_01_GB_PHI", week: 1, away_team: "GB", away_score: 29, home_team: "PHI", home_score: 34 },
  { game_id: "2024_02_CIN_KC", week: 2, away_team: "CIN", away_score: 25, home_team: "KC", home_score: 26 },
  { game_id: "2024_02_ATL_PHI", week: 2, away_team: "ATL", away_score: 22, home_team: "PHI", home_score: 21 },
  { game_id: "2024_03_PHI_NO", week: 3, away_team: "PHI", away_score: 15, home_team: "NO", home_score: 12 },
  { game_id: "2024_03_KC_ATL", week: 3, away_team: "KC", away_score: 22, home_team: "ATL", home_score: 17 },
  { game_id: "2024_04_PHI_TB", week: 4, away_team: "PHI", away_score: 16, home_team: "TB", home_score: 33 },
  { game_id: "2024_04_KC_LAC", week: 4, away_team: "KC", away_score: 17, home_team: "LAC", home_score: 10 },
  { game_id: "2024_05_NO_KC", week: 5, away_team: "NO", away_score: 13, home_team: "KC", home_score: 26 },
  { game_id: "2024_06_CLE_PHI", week: 6, away_team: "CLE", away_score: 16, home_team: "PHI", home_score: 20 },
  { game_id: "2024_07_PHI_NYG", week: 7, away_team: "PHI", away_score: 28, home_team: "NYG", home_score: 3 },
  { game_id: "2024_07_KC_SF", week: 7, away_team: "KC", away_score: 28, home_team: "SF", home_score: 18 },
  { game_id: "2024_08_PHI_CIN", week: 8, away_team: "PHI", away_score: 37, home_team: "CIN", home_score: 17 },
  { game_id: "2024_08_KC_LV", week: 8, away_team: "KC", away_score: 27, home_team: "LV", home_score: 20 },
  { game_id: "2024_09_JAX_PHI", week: 9, away_team: "JAX", away_score: 23, home_team: "PHI", home_score: 28 },
  { game_id: "2024_09_TB_KC", week: 9, away_team: "TB", away_score: 24, home_team: "KC", home_score: 30 },
  { game_id: "2024_10_DEN_KC", week: 10, away_team: "DEN", away_score: 14, home_team: "KC", home_score: 16 },
  { game_id: "2024_10_PHI_DAL", week: 10, away_team: "PHI", away_score: 34, home_team: "DAL", home_score: 6 },
  { game_id: "2024_11_WAS_PHI", week: 11, away_team: "WAS", away_score: 18, home_team: "PHI", home_score: 26 },
  { game_id: "2024_11_KC_BUF", week: 11, away_team: "KC", away_score: 21, home_team: "BUF", home_score: 30 },
  { game_id: "2024_12_KC_CAR", week: 12, away_team: "KC", away_score: 30, home_team: "CAR", home_score: 27 },
  { game_id: "2024_12_PHI_LA", week: 12, away_team: "PHI", away_score: 37, home_team: "LA", home_score: 20 },
  { game_id: "2024_13_LV_KC", week: 13, away_team: "LV", away_score: 17, home_team: "KC", home_score: 19 },
  { game_id: "2024_13_PHI_BAL", week: 13, away_team: "PHI", away_score: 24, home_team: "BAL", home_score: 19 },
  { game_id: "2024_14_CAR_PHI", week: 14, away_team: "CAR", away_score: 16, home_team: "PHI", home_score: 22 },
  { game_id: "2024_14_LAC_KC", week: 14, away_team: "LAC", away_score: 17, home_team: "KC", home_score: 19 },
  { game_id: "2024_15_KC_CLE", week: 15, away_team: "KC", away_score: 21, home_team: "CLE", home_score: 7 },
  { game_id: "2024_15_PIT_PHI", week: 15, away_team: "PIT", away_score: 13, home_team: "PHI", home_score: 27 },
  { game_id: "2024_16_HOU_KC", week: 16, away_team: "HOU", away_score: 19, home_team: "KC", home_score: 27 },
  { game_id: "2024_16_PHI_WAS", week: 16, away_team: "PHI", away_score: 33, home_team: "WAS", home_score: 36 },
  { game_id: "2024_17_KC_PIT", week: 17, away_team: "KC", away_score: 29, home_team: "PIT", home_score: 10 },
  { game_id: "2024_17_DAL_PHI", week: 17, away_team: "DAL", away_score: 7, home_team: "PHI", home_score: 41 },
  { game_id: "2024_18_NYG_PHI", week: 18, away_team: "NYG", away_score: 13, home_team: "PHI", home_score: 20 },
  { game_id: "2024_18_KC_DEN", week: 18, away_team: "KC", away_score: 0, home_team: "DEN", home_score: 38 },
];
/** One AFC team's 2024 regular season week by week: index 0 is week 1, `null` the bye week. */
export type AfcWeeks = {
  readonly team: string;
  /** Points scored minus points allowed in each week's game. */
  readonly margins: readonly (number | null)[];
  /** Points scored in each week's game. */
  readonly points: readonly (number | null)[];
};
/**
 * The eight STANDINGS teams' 2024 regular seasons as weekly series (weeks 1 to 18, the bye a gap), in STANDINGS'
 * order, from fixtures/examples/nfl_games_2024_reg.csv: what the in-cell charts (sparkline, sparkbar) draw.
 */
// biome-ignore format: one team per line
export const AFC_WEEKS_2024: readonly AfcWeeks[] = [
  { team: "KC", margins: [7, 1, 5, 7, 13, null, 10, 7, 6, 2, -9, 3, 2, 2, 14, 8, 19, -38], points: [27, 26, 22, 17, 26, null, 28, 27, 30, 16, 21, 30, 19, 19, 21, 27, 29, 0] },
  { team: "LAC", margins: [12, 23, -10, -7, null, 7, -2, 18, 17, 10, 7, -7, 4, -2, -23, 7, 33, 14], points: [22, 26, 10, 10, null, 23, 15, 26, 27, 27, 34, 23, 17, 17, 17, 34, 40, 34] },
  { team: "DEN", margins: [-6, -7, 19, 1, 16, -7, 23, 14, -31, -2, 32, 10, 9, null, 18, -7, -6, 38], points: [20, 6, 26, 10, 34, 16, 33, 28, 10, 14, 38, 29, 41, null, 31, 27, 24, 38] },
  { team: "LV", margins: [-12, 3, -14, 4, -16, -19, -5, -7, -17, null, -15, -10, -2, -15, -6, 5, 15, -14], points: [10, 26, 22, 20, 18, 13, 15, 20, 24, null, 19, 19, 17, 13, 9, 19, 25, 20] },
  { team: "BUF", margins: [6, 21, 37, -25, -3, 3, 24, 21, 3, 10, 9, null, 25, -2, 6, 3, 26, -7], points: [34, 31, 47, 10, 20, 23, 34, 31, 30, 30, 30, null, 35, 42, 48, 24, 40, 16] },
  { team: "MIA", margins: [3, -21, -21, -19, 5, null, -6, -1, -3, 8, 15, 19, -13, 6, -8, 12, 17, -12], points: [20, 10, 3, 12, 15, null, 10, 27, 27, 23, 34, 34, 17, 32, 12, 29, 20, 20] },
  { team: "NYJ", margins: [-13, 7, 21, -1, -6, -3, -22, -3, 8, -25, -1, null, -5, -6, 7, -10, -26, 12], points: [19, 24, 24, 9, 17, 20, 15, 22, 21, 6, 27, null, 21, 26, 32, 9, 14, 32] },
  { team: "NE", margins: [6, -3, -21, -17, -5, -20, -16, 3, -3, 16, -6, -19, -1, null, -13, -3, -33, 7], points: [16, 20, 3, 13, 10, 21, 16, 25, 17, 19, 22, 15, 24, null, 17, 21, 7, 23] },
];
/**
 * One SPADL action (socceraction 1.5.3) of StatsBomb open-data match 8658: metres from the bottom-left corner of a
 * 105 x 68 pitch, attacking left to right (fixtures/examples/spadl_8658_france_h1_passes.csv).
 */
export type SpadlPass = {
  readonly action_id: number;
  readonly time_seconds: number;
  readonly player_id: number;
  readonly start_x: number;
  readonly start_y: number;
  readonly end_x: number;
  readonly end_y: number;
};
/** France's 75 completed first-half passes in the 2018 World Cup final (StatsBomb open data, attribution required). */
// biome-ignore format: one captured pass per line
export const WC2018_FINAL_FRANCE_PASSES: readonly SpadlPass[] = [
  { action_id: 42, time_seconds: 61.947, player_id: 5487, start_x: 54.68750000000001, start_y: 6.375, end_x: 56.4375, end_y: 1.2750000000000057 },
  { action_id: 46, time_seconds: 74.667, player_id: 5485, start_x: 22.3125, start_y: 9.775000000000006, end_x: 6.5625, end_y: 31.875 },
  { action_id: 48, time_seconds: 77.227, player_id: 3099, start_x: 6.5625, start_y: 31.875, end_x: 16.1875, end_y: 43.775 },
  { action_id: 51, time_seconds: 96.867, player_id: 5492, start_x: 35.4375, start_y: 42.925, end_x: 48.5625, end_y: 44.625 },
  { action_id: 53, time_seconds: 99.027, player_id: 4375, start_x: 47.6875, start_y: 45.475, end_x: 33.6875, end_y: 48.875 },
  { action_id: 55, time_seconds: 101.787, player_id: 5492, start_x: 36.3125, start_y: 47.175, end_x: 59.9375, end_y: 46.325 },
  { action_id: 56, time_seconds: 102.88, player_id: 3604, start_x: 59.9375, start_y: 46.325, end_x: 56.4375, end_y: 46.325 },
  { action_id: 57, time_seconds: 103.44, player_id: 4375, start_x: 56.4375, start_y: 46.325, end_x: 52.9375, end_y: 42.075 },
  { action_id: 58, time_seconds: 105.44, player_id: 3604, start_x: 52.9375, start_y: 42.075, end_x: 38.9375, end_y: 27.625 },
  { action_id: 60, time_seconds: 107.107, player_id: 5485, start_x: 38.9375, start_y: 27.625, end_x: 47.6875, end_y: 12.325000000000003 },
  { action_id: 107, time_seconds: 259.227, player_id: 4375, start_x: 9.1875, start_y: 64.175, end_x: 6.5625, end_y: 55.675 },
  { action_id: 109, time_seconds: 260.427, player_id: 3961, start_x: 7.4375, start_y: 55.675, end_x: 9.1875, end_y: 65.875 },
  { action_id: 111, time_seconds: 261.787, player_id: 5484, start_x: 9.1875, start_y: 65.875, end_x: 6.5625, end_y: 57.375 },
  { action_id: 126, time_seconds: 293.147, player_id: 3961, start_x: 22.3125, start_y: 65.025, end_x: 11.8125, end_y: 56.525 },
  { action_id: 131, time_seconds: 318.107, player_id: 5485, start_x: 22.3125, start_y: 14.025000000000006, end_x: 30.187499999999996, end_y: 21.674999999999997 },
  { action_id: 133, time_seconds: 320.067, player_id: 20004, start_x: 29.3125, start_y: 21.674999999999997, end_x: 22.3125, end_y: 43.775 },
  { action_id: 137, time_seconds: 345.707, player_id: 3961, start_x: 47.6875, start_y: 58.225, end_x: 40.6875, end_y: 59.925 },
  { action_id: 139, time_seconds: 346.747, player_id: 5492, start_x: 40.6875, start_y: 59.925, end_x: 47.6875, end_y: 59.925 },
  { action_id: 141, time_seconds: 348.987, player_id: 3961, start_x: 46.8125, start_y: 55.675, end_x: 38.9375, end_y: 33.575 },
  { action_id: 143, time_seconds: 353.867, player_id: 20004, start_x: 46.8125, start_y: 29.325000000000003, end_x: 52.0625, end_y: 5.525000000000006 },
  { action_id: 145, time_seconds: 357.027, player_id: 5476, start_x: 49.4375, start_y: 8.075000000000003, end_x: 39.8125, end_y: 14.025000000000006 },
  { action_id: 147, time_seconds: 359.187, player_id: 5485, start_x: 38.9375, start_y: 17.424999999999997, end_x: 35.4375, end_y: 42.075 },
  { action_id: 149, time_seconds: 362.547, player_id: 5492, start_x: 38.9375, start_y: 42.925, end_x: 47.6875, end_y: 64.175 },
  { action_id: 198, time_seconds: 572.867, player_id: 3099, start_x: 8.3125, start_y: 41.225, end_x: 28.437499999999996, end_y: 49.725 },
  { action_id: 242, time_seconds: 680.267, player_id: 3604, start_x: 66.0625, start_y: 26.775000000000006, end_x: 59.0625, end_y: 23.375 },
  { action_id: 244, time_seconds: 681.427, player_id: 20004, start_x: 59.0625, start_y: 23.375, end_x: 69.5625, end_y: 51.425 },
  { action_id: 252, time_seconds: 707.027, player_id: 20004, start_x: 67.8125, start_y: 64.175, end_x: 53.81249999999999, end_y: 63.325 },
  { action_id: 254, time_seconds: 708.987, player_id: 5492, start_x: 54.68750000000001, start_y: 61.625, end_x: 49.4375, end_y: 39.525 },
  { action_id: 256, time_seconds: 712.547, player_id: 5485, start_x: 50.3125, start_y: 28.474999999999994, end_x: 58.1875, end_y: 2.125 },
  { action_id: 258, time_seconds: 716.667, player_id: 5476, start_x: 58.1875, start_y: 8.924999999999997, end_x: 46.8125, end_y: 14.025000000000006 },
  { action_id: 260, time_seconds: 719.947, player_id: 5485, start_x: 44.1875, start_y: 17.424999999999997, end_x: 50.3125, end_y: 12.325000000000003 },
  { action_id: 262, time_seconds: 722.787, player_id: 5476, start_x: 42.4375, start_y: 11.474999999999994, end_x: 11.8125, end_y: 24.224999999999994 },
  { action_id: 270, time_seconds: 737.187, player_id: 4375, start_x: 46.8125, start_y: 44.625, end_x: 48.5625, end_y: 65.875 },
  { action_id: 271, time_seconds: 739.547, player_id: 5484, start_x: 48.5625, start_y: 65.875, end_x: 57.31249999999999, end_y: 63.325 },
  { action_id: 272, time_seconds: 740.467, player_id: 5487, start_x: 57.31249999999999, start_y: 63.325, end_x: 45.0625, end_y: 60.775 },
  { action_id: 274, time_seconds: 742.787, player_id: 4375, start_x: 45.0625, start_y: 60.775, end_x: 38.0625, end_y: 46.325 },
  { action_id: 276, time_seconds: 744.907, player_id: 5492, start_x: 38.0625, start_y: 46.325, end_x: 39.8125, end_y: 26.775000000000006 },
  { action_id: 278, time_seconds: 748.587, player_id: 5485, start_x: 45.0625, start_y: 23.375, end_x: 56.4375, end_y: 1.2750000000000057 },
  { action_id: 284, time_seconds: 761.347, player_id: 5485, start_x: 36.3125, start_y: 8.075000000000003, end_x: 35.4375, end_y: 39.525 },
  { action_id: 324, time_seconds: 947.107, player_id: 5484, start_x: 31.0625, start_y: 65.875, end_x: 30.187499999999996, end_y: 58.225 },
  { action_id: 326, time_seconds: 947.627, player_id: 3961, start_x: 30.187499999999996, start_y: 58.225, end_x: 37.1875, end_y: 64.175 },
  { action_id: 328, time_seconds: 949.107, player_id: 4375, start_x: 38.0625, start_y: 62.475, end_x: 43.3125, end_y: 42.075 },
  { action_id: 330, time_seconds: 951.347, player_id: 20004, start_x: 41.5625, start_y: 39.525, end_x: 48.5625, end_y: 4.674999999999997 },
  { action_id: 334, time_seconds: 956.787, player_id: 3009, start_x: 38.9375, start_y: 14.875, end_x: 24.9375, end_y: 22.525000000000006 },
  { action_id: 336, time_seconds: 959.107, player_id: 5485, start_x: 23.1875, start_y: 23.375, end_x: 33.6875, end_y: 42.075 },
  { action_id: 338, time_seconds: 962.107, player_id: 3961, start_x: 38.9375, start_y: 42.925, end_x: 45.9375, end_y: 43.775 },
  { action_id: 339, time_seconds: 963.16, player_id: 4375, start_x: 45.9375, start_y: 43.775, end_x: 39.8125, end_y: 48.875 },
  { action_id: 353, time_seconds: 980.267, player_id: 3604, start_x: 79.1875, start_y: 2.125, end_x: 49.4375, end_y: 14.025000000000006 },
  { action_id: 355, time_seconds: 984.467, player_id: 5485, start_x: 49.4375, start_y: 21.674999999999997, end_x: 57.31249999999999, end_y: 62.475 },
  { action_id: 359, time_seconds: 993.787, player_id: 5487, start_x: 82.6875, start_y: 25.075000000000003, end_x: 93.1875, end_y: 12.325000000000003 },
  { action_id: 372, time_seconds: 1012.507, player_id: 5485, start_x: 70.4375, start_y: 9.775000000000006, end_x: 80.0625, end_y: 20.825000000000003 },
  { action_id: 394, time_seconds: 1182.867, player_id: 5484, start_x: 17.0625, start_y: 53.125, end_x: 28.437499999999996, end_y: 53.975 },
  { action_id: 396, time_seconds: 1185.267, player_id: 3961, start_x: 29.3125, start_y: 58.225, end_x: 29.3125, end_y: 66.725 },
  { action_id: 398, time_seconds: 1185.947, player_id: 4375, start_x: 29.3125, start_y: 66.725, end_x: 38.9375, end_y: 59.925 },
  { action_id: 411, time_seconds: 1309.547, player_id: 5492, start_x: 41.5625, start_y: 65.875, end_x: 21.4375, end_y: 42.925 },
  { action_id: 427, time_seconds: 1341.107, player_id: 4375, start_x: 49.4375, start_y: 47.175, end_x: 55.5625, end_y: 38.675 },
  { action_id: 428, time_seconds: 1343.067, player_id: 20004, start_x: 55.5625, start_y: 38.675, end_x: 78.3125, end_y: 25.924999999999997 },
  { action_id: 449, time_seconds: 1457.227, player_id: 5487, start_x: 70.4375, start_y: 45.475, end_x: 73.9375, end_y: 65.875 },
  { action_id: 454, time_seconds: 1491.307, player_id: 4375, start_x: 59.0625, start_y: 63.325, end_x: 70.4375, end_y: 46.325 },
  { action_id: 463, time_seconds: 1512.387, player_id: 5492, start_x: 37.1875, start_y: 53.975, end_x: 57.31249999999999, end_y: 48.025 },
  { action_id: 466, time_seconds: 1534.347, player_id: 5485, start_x: 27.5625, start_y: 25.075000000000003, end_x: 27.5625, end_y: 54.825 },
  { action_id: 482, time_seconds: 1590.307, player_id: 5487, start_x: 54.68750000000001, start_y: 46.325, end_x: 41.5625, end_y: 7.224999999999994 },
  { action_id: 484, time_seconds: 1596.147, player_id: 5476, start_x: 46.8125, start_y: 4.674999999999997, end_x: 58.1875, end_y: 1.2750000000000057 },
  { action_id: 485, time_seconds: 1597.227, player_id: 3009, start_x: 58.1875, start_y: 1.2750000000000057, end_x: 60.81250000000001, end_y: 8.075000000000003 },
  { action_id: 512, time_seconds: 1784.267, player_id: 5485, start_x: 59.9375, start_y: 31.025000000000006, end_x: 13.562500000000002, end_y: 33.575 },
  { action_id: 514, time_seconds: 1789.427, player_id: 3099, start_x: 15.312500000000002, start_y: 31.875, end_x: 60.81250000000001, end_y: 5.525000000000006 },
  { action_id: 526, time_seconds: 1840.427, player_id: 20004, start_x: 31.937499999999996, start_y: 61.625, end_x: 39.8125, end_y: 51.425 },
  { action_id: 599, time_seconds: 2382.107, player_id: 3099, start_x: 12.6875, start_y: 25.075000000000003, end_x: 65.1875, end_y: 17.424999999999997 },
  { action_id: 600, time_seconds: 2385.067, player_id: 3604, start_x: 64.3125, start_y: 17.424999999999997, end_x: 63.43749999999999, end_y: 2.9749999999999943 },
  { action_id: 692, time_seconds: 2765.027, player_id: 5485, start_x: 36.3125, start_y: 36.125, end_x: 48.5625, end_y: 43.775 },
  { action_id: 696, time_seconds: 2767.787, player_id: 5487, start_x: 45.0625, start_y: 43.775, end_x: 41.5625, end_y: 41.225 },
  { action_id: 698, time_seconds: 2768.987, player_id: 4375, start_x: 41.5625, start_y: 41.225, end_x: 32.8125, end_y: 39.525 },
  { action_id: 700, time_seconds: 2770.547, player_id: 5492, start_x: 32.8125, start_y: 39.525, end_x: 56.4375, end_y: 25.075000000000003 },
  { action_id: 708, time_seconds: 2795.987, player_id: 3099, start_x: 15.312500000000002, start_y: 39.525, end_x: 84.4375, end_y: 28.474999999999994 },
  { action_id: 723, time_seconds: 2826.92, player_id: 3604, start_x: 60.81250000000001, start_y: 49.725, end_x: 60.81250000000001, end_y: 44.625 },
];
/**
 * Who received one of France's completed first-half passes in the 2018 World Cup final: the StatsBomb open-data event
 * behind each `WC2018_FINAL_FRANCE_PASSES` row (same `action_id`), its passer and `pass.recipient`, with each player's
 * name from the match lineup (fixtures/examples/statsbomb_8658_france_h1_pass_recipients.csv).
 */
export type PassRecipient = {
  readonly action_id: number;
  readonly player_id: number;
  readonly player_name: string;
  readonly recipient_id: number;
  readonly recipient_name: string;
};
/** The passer and receiver of each of France's 75 completed first-half passes (StatsBomb open data, attribution required). */
// biome-ignore format: one captured pass per line
export const WC2018_FINAL_FRANCE_RECIPIENTS: readonly PassRecipient[] = [
  { action_id: 42, player_id: 5487, player_name: "Antoine Griezmann", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 46, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 3099, recipient_name: "Hugo Lloris" },
  { action_id: 48, player_id: 3099, player_name: "Hugo Lloris", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 51, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 53, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 55, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 3604, recipient_name: "Olivier Giroud" },
  { action_id: 56, player_id: 3604, player_name: "Olivier Giroud", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 57, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 3604, recipient_name: "Olivier Giroud" },
  { action_id: 58, player_id: 3604, player_name: "Olivier Giroud", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 60, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 107, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 109, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 5484, recipient_name: "Lucas Hernandez" },
  { action_id: 111, player_id: 5484, player_name: "Lucas Hernandez", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 126, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 131, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 133, player_id: 20004, player_name: "Paul Pogba", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 137, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 139, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 141, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 143, player_id: 20004, player_name: "Paul Pogba", recipient_id: 5476, recipient_name: "Benjamin Pavard" },
  { action_id: 145, player_id: 5476, player_name: "Benjamin Pavard", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 147, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 149, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 198, player_id: 3099, player_name: "Hugo Lloris", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 242, player_id: 3604, player_name: "Olivier Giroud", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 244, player_id: 20004, player_name: "Paul Pogba", recipient_id: 5484, recipient_name: "Lucas Hernandez" },
  { action_id: 252, player_id: 20004, player_name: "Paul Pogba", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 254, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 256, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5476, recipient_name: "Benjamin Pavard" },
  { action_id: 258, player_id: 5476, player_name: "Benjamin Pavard", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 260, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5476, recipient_name: "Benjamin Pavard" },
  { action_id: 262, player_id: 5476, player_name: "Benjamin Pavard", recipient_id: 3099, recipient_name: "Hugo Lloris" },
  { action_id: 270, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 5484, recipient_name: "Lucas Hernandez" },
  { action_id: 271, player_id: 5484, player_name: "Lucas Hernandez", recipient_id: 5487, recipient_name: "Antoine Griezmann" },
  { action_id: 272, player_id: 5487, player_name: "Antoine Griezmann", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 274, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 276, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 278, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 284, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 324, player_id: 5484, player_name: "Lucas Hernandez", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 326, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 328, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 330, player_id: 20004, player_name: "Paul Pogba", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 334, player_id: 3009, player_name: "Kylian Mbappé", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 336, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 338, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 339, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 353, player_id: 3604, player_name: "Olivier Giroud", recipient_id: 5485, recipient_name: "Raphaël Varane" },
  { action_id: 355, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5484, recipient_name: "Lucas Hernandez" },
  { action_id: 359, player_id: 5487, player_name: "Antoine Griezmann", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 372, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5487, recipient_name: "Antoine Griezmann" },
  { action_id: 394, player_id: 5484, player_name: "Lucas Hernandez", recipient_id: 3961, recipient_name: "N'Golo Kanté" },
  { action_id: 396, player_id: 3961, player_name: "N'Golo Kanté", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 398, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 3604, recipient_name: "Olivier Giroud" },
  { action_id: 411, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 3099, recipient_name: "Hugo Lloris" },
  { action_id: 427, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 428, player_id: 20004, player_name: "Paul Pogba", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 449, player_id: 5487, player_name: "Antoine Griezmann", recipient_id: 5484, recipient_name: "Lucas Hernandez" },
  { action_id: 454, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 5487, recipient_name: "Antoine Griezmann" },
  { action_id: 463, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 3604, recipient_name: "Olivier Giroud" },
  { action_id: 466, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 482, player_id: 5487, player_name: "Antoine Griezmann", recipient_id: 5476, recipient_name: "Benjamin Pavard" },
  { action_id: 484, player_id: 5476, player_name: "Benjamin Pavard", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 485, player_id: 3009, player_name: "Kylian Mbappé", recipient_id: 5476, recipient_name: "Benjamin Pavard" },
  { action_id: 512, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 3099, recipient_name: "Hugo Lloris" },
  { action_id: 514, player_id: 3099, player_name: "Hugo Lloris", recipient_id: 5476, recipient_name: "Benjamin Pavard" },
  { action_id: 526, player_id: 20004, player_name: "Paul Pogba", recipient_id: 5487, recipient_name: "Antoine Griezmann" },
  { action_id: 599, player_id: 3099, player_name: "Hugo Lloris", recipient_id: 3604, recipient_name: "Olivier Giroud" },
  { action_id: 600, player_id: 3604, player_name: "Olivier Giroud", recipient_id: 3009, recipient_name: "Kylian Mbappé" },
  { action_id: 692, player_id: 5485, player_name: "Raphaël Varane", recipient_id: 5487, recipient_name: "Antoine Griezmann" },
  { action_id: 696, player_id: 5487, player_name: "Antoine Griezmann", recipient_id: 4375, recipient_name: "Blaise Matuidi" },
  { action_id: 698, player_id: 4375, player_name: "Blaise Matuidi", recipient_id: 5492, recipient_name: "Samuel Umtiti" },
  { action_id: 700, player_id: 5492, player_name: "Samuel Umtiti", recipient_id: 20004, recipient_name: "Paul Pogba" },
  { action_id: 708, player_id: 3099, player_name: "Hugo Lloris", recipient_id: 3604, recipient_name: "Olivier Giroud" },
  { action_id: 723, player_id: 3604, player_name: "Olivier Giroud", recipient_id: 5484, recipient_name: "Lucas Hernandez" },
];
/**
 * One Statcast pitch from Baseball Savant's pitch-level search
 * (fixtures/examples/mlb_statcast_search_2024-06-15_head.csv): Savant's own column names and values. Feet, feet per second and feet per second squared in Statcast's frame: x to
 * the catcher's right (first-base side), y from the point of home plate towards the mound, z up. `vx0`..`vz0` are the
 * velocity at y = 50 ft and `ax`..`az` the (constant) acceleration of the nine-parameter fit; `plate_x`/`plate_z` are
 * where it crossed the front of home plate (through 2025). `player_name` is the batter, `pitcher` an MLBAM id.
 */
export type StatcastPitchRow = {
  readonly game_pk: number;
  readonly game_date: string;
  readonly game_year: number;
  readonly home_team: string;
  readonly away_team: string;
  readonly inning_topbot: "Top" | "Bot";
  readonly at_bat_number: number;
  readonly pitch_number: number;
  readonly pitcher: number;
  readonly player_name: string;
  readonly pitch_type: string;
  readonly pitch_name: string;
  readonly description: string;
  readonly release_speed: number;
  readonly release_pos_x: number;
  readonly release_pos_y: number;
  readonly release_pos_z: number;
  readonly vx0: number;
  readonly vy0: number;
  readonly vz0: number;
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly plate_x: number;
  readonly plate_z: number;
};
/** The 46 pitches of the Savant capture for 2024-06-15, in its order (MLB Advanced Media data via Baseball Savant). */
// biome-ignore format: one captured pitch per line
export const STATCAST_PITCHES_2024_06_15: readonly StatcastPitchRow[] = [
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 48, pitch_number: 4, pitcher: 607074, player_name: "Westbrook, Jamie", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "swinging_strike", release_speed: 96.3, release_pos_x: 2.05, release_pos_y: 54.12, release_pos_z: 6.17, vx0: -6.245145230392043, vy0: -140.0548111003631, vz0: -4.647911601289857, ax: 12.681580763686934, ay: 32.15363682007945, az: -12.428443024407864, plate_x: 0.42927397039380755, plate_z: 3.546869816011372 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 55, pitch_number: 4, pitcher: 607200, player_name: "Moreno, Gabriel", pitch_type: "ST", pitch_name: "Sweeper", description: "hit_into_play", release_speed: 85.1, release_pos_x: -1.3, release_pos_y: 53.85, release_pos_z: 5.64, vx0: 2.3049322532569807, vy0: -124.01088432728022, vz0: -3.1216700081995925, ax: 11.496510232776677, ay: 24.958111259163207, az: -30.671605181348564, plate_x: 0.6625965015436488, plate_z: 1.7252325768549186 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 48, pitch_number: 3, pitcher: 607074, player_name: "Westbrook, Jamie", pitch_type: "SL", pitch_name: "Slider", description: "swinging_strike", release_speed: 87, release_pos_x: 2.45, release_pos_y: 54.39, release_pos_z: 5.93, vx0: -7.433126312776495, vy0: -126.48078685558848, vz0: -5.14746025719105, ax: -3.552610656705953, ay: 23.806158570825176, az: -33.69446225854145, plate_x: -1.0542876434888326, plate_z: 1.036543182075246 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 48, pitch_number: 2, pitcher: 607074, player_name: "Westbrook, Jamie", pitch_type: "CH", pitch_name: "Changeup", description: "ball", release_speed: 86.6, release_pos_x: 2.45, release_pos_y: 54.26, release_pos_z: 5.94, vx0: -1.4748646112974004, vy0: -126.01641734065025, vz0: -7.422065033451653, ax: 11.75566002073086, ay: 24.166314927624562, az: -29.151034373685132, plate_x: 2.745777992060211, plate_z: 0.3866975138670834 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 55, pitch_number: 3, pitcher: 607200, player_name: "Moreno, Gabriel", pitch_type: "SI", pitch_name: "Sinker", description: "called_strike", release_speed: 94.2, release_pos_x: -1.15, release_pos_y: 53.76, release_pos_z: 5.83, vx0: 6.7039097088120565, vy0: -137.12426681177442, vz0: -3.7548476242029927, ax: -7.500764872848528, ay: 27.94948748205221, az: -23.93777021054851, plate_x: 0.9990783893178665, plate_z: 2.735827341168333 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 55, pitch_number: 2, pitcher: 607200, player_name: "Moreno, Gabriel", pitch_type: "SI", pitch_name: "Sinker", description: "called_strike", release_speed: 94, release_pos_x: -1.28, release_pos_y: 53.67, release_pos_z: 5.75, vx0: 6.449637765516566, vy0: -136.72556200780105, vz0: -6.050153716321323, ax: -8.17550399766504, ay: 28.439375865963434, az: -22.802143851874302, plate_x: 0.7229391079850024, plate_z: 1.8068075485789596 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 48, pitch_number: 1, pitcher: 607074, player_name: "Westbrook, Jamie", pitch_type: "CU", pitch_name: "Curveball", description: "foul", release_speed: 81.3, release_pos_x: 2, release_pos_y: 54.37, release_pos_z: 6.22, vx0: -4.854067305698742, vy0: -118.28995199750955, vz0: -2.275686458798066, ax: -4.980880074191283, ay: 22.908457785647148, az: -41.533134822036416, plate_x: -0.7161844608970884, plate_z: 1.3731513595739493 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 47, pitch_number: 4, pitcher: 607074, player_name: "Yoshida, Masataka", pitch_type: "SL", pitch_name: "Slider", description: "hit_into_play", release_speed: 85.8, release_pos_x: 2.46, release_pos_y: 54.49, release_pos_z: 6.04, vx0: -4.191126974361751, vy0: -124.92285953010968, vz0: -0.29000208475086, ax: -6.400024262692358, ay: 25.525084212588368, az: -34.5839696053278, plate_x: 0.08517380611810554, plate_z: 3.0840631752695686 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 48, pitch_number: 6, pitcher: 450203, player_name: "Arozarena, Randy", pitch_type: "CU", pitch_name: "Curveball", description: "hit_into_play", release_speed: 82.3, release_pos_x: -2.29, release_pos_y: 54.21, release_pos_z: 5.42, vx0: 4.613504959260108, vy0: -119.85426091168044, vz0: -0.2891044071271549, ax: 8.999543887763778, ay: 23.298967826453996, az: -39.352290128110084, plate_x: 0.6208397955065249, plate_z: 1.790814346215733 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 55, pitch_number: 1, pitcher: 607200, player_name: "Moreno, Gabriel", pitch_type: "ST", pitch_name: "Sweeper", description: "ball", release_speed: 84.5, release_pos_x: -1.68, release_pos_y: 53.81, release_pos_z: 5.63, vx0: 2.915423329540476, vy0: -123.02610109511934, vz0: -4.373219026544612, ax: 6.896535758467838, ay: 23.534981966733852, az: -28.340377297613024, plate_x: 0.18611085773365432, plate_z: 1.31353166790581 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 54, pitch_number: 6, pitcher: 607200, player_name: "Suárez, Eugenio", pitch_type: "FC", pitch_name: "Cutter", description: "hit_into_play", release_speed: 90.6, release_pos_x: -1.13, release_pos_y: 53.73, release_pos_z: 5.79, vx0: 3.9476132568005937, vy0: -132.06313641133025, vz0: -2.5376528445942013, ax: 4.567232653232439, ay: 24.70771646914816, az: -26.97074839621649, plate_x: 0.8219074807799613, plate_z: 2.7978004336075406 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 48, pitch_number: 5, pitcher: 450203, player_name: "Arozarena, Randy", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "foul", release_speed: 93.4, release_pos_x: -2.23, release_pos_y: 54.29, release_pos_z: 5.5, vx0: 6.028921285880093, vy0: -135.970015891962, vz0: -1.7724979846603013, ax: -13.494891538573045, ay: 28.0919604663397, az: -20.578020245366908, plate_x: -0.7232797874101076, plate_z: 3.374008524521765 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 47, pitch_number: 3, pitcher: 607074, player_name: "Yoshida, Masataka", pitch_type: "SL", pitch_name: "Slider", description: "called_strike", release_speed: 89.1, release_pos_x: 2.31, release_pos_y: 54.48, release_pos_z: 6.02, vx0: -5.204212165270972, vy0: -129.76961265770944, vz0: -1.0655805711980935, ax: -5.691738712487278, ay: 26.028675839313205, az: -29.912376317534804, plate_x: -0.32295218465442826, plate_z: 3.3186164993586087 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 54, pitch_number: 5, pitcher: 607200, player_name: "Suárez, Eugenio", pitch_type: "ST", pitch_name: "Sweeper", description: "foul", release_speed: 84.8, release_pos_x: -1.51, release_pos_y: 53.87, release_pos_z: 5.63, vx0: 2.730498924710361, vy0: -123.6196277010734, vz0: -4.118959523138115, ax: 10.074609597684077, ay: 22.81412553032779, az: -26.174134207260607, plate_x: 0.5296791154711505, plate_z: 1.6532946644678148 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 8, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "ST", pitch_name: "Sweeper", description: "swinging_strike", release_speed: 84.1, release_pos_x: 2.87, release_pos_y: 54.18, release_pos_z: 5.25, vx0: -6.9501409213948415, vy0: -122.32135589054762, vz0: -2.7540373110025764, ax: -7.973894162124396, ay: 23.99074025692966, az: -32.05248679684202, plate_x: -0.9186331742956033, plate_z: 1.2886589191531272 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 47, pitch_number: 2, pitcher: 607074, player_name: "Yoshida, Masataka", pitch_type: "SL", pitch_name: "Slider", description: "ball", release_speed: 86.4, release_pos_x: 2.29, release_pos_y: 54.43, release_pos_z: 6.07, vx0: -5.4159197975532996, vy0: -125.7739426652977, vz0: -4.49808112321914, ax: -4.137765879871159, ay: 25.267052319549506, az: -33.7413522470103, plate_x: -0.4147955980762106, plate_z: 1.3908146161449992 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 48, pitch_number: 4, pitcher: 450203, player_name: "Arozarena, Randy", pitch_type: "SI", pitch_name: "Sinker", description: "ball", release_speed: 94.2, release_pos_x: -2.11, release_pos_y: 54.29, release_pos_z: 5.4, vx0: 11.368056870189827, vy0: -136.70244794143255, vz0: -5.599453245670873, ax: -20.11529622680441, ay: 27.22689794193441, az: -28.681054176335437, plate_x: 1.081795185907291, plate_z: 1.224278337992652 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 7, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "foul", release_speed: 93, release_pos_x: 2.48, release_pos_y: 54.11, release_pos_z: 5.28, vx0: -9.226162554866118, vy0: -135.09848838204283, vz0: -5.513946075936735, ax: 12.936331917024953, ay: 26.948404220382823, az: -13.970845812874998, plate_x: -0.35398845405942014, plate_z: 2.086263358621839 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 48, pitch_number: 3, pitcher: 450203, player_name: "Arozarena, Randy", pitch_type: "CU", pitch_name: "Curveball", description: "swinging_strike", release_speed: 82.2, release_pos_x: -2.23, release_pos_y: 54.26, release_pos_z: 5.37, vx0: 3.2210893620727394, vy0: -119.73704254661871, vz0: -0.654389084886364, ax: 9.29071006145638, ay: 23.31679647772255, az: -40.59254630852604, plate_x: 0.06867446777494135, plate_z: 1.4628924417202138 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 47, pitch_number: 1, pitcher: 607074, player_name: "Yoshida, Masataka", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "called_strike", release_speed: 95.5, release_pos_x: 1.85, release_pos_y: 54.2, release_pos_z: 6.28, vx0: -7.151812726779905, vy0: -138.63787884108902, vz0: -8.81630980699194, ax: 13.033998226622783, ay: 32.49239104450145, az: -10.194154898067119, plate_x: -0.11883793893187156, plate_z: 2.1121659504972805 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 54, pitch_number: 4, pitcher: 607200, player_name: "Suárez, Eugenio", pitch_type: "CH", pitch_name: "Changeup", description: "ball", release_speed: 87.7, release_pos_x: -1.53, release_pos_y: 53.95, release_pos_z: 5.79, vx0: 2.3861529237529036, vy0: -127.83587804751618, vz0: -4.829411707274711, ax: -8.760079614627758, ay: 23.767341805357567, az: -25.53320341218999, plate_x: -1.1942941603264479, plate_z: 1.762500476952984 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 48, pitch_number: 2, pitcher: 450203, player_name: "Arozarena, Randy", pitch_type: "SI", pitch_name: "Sinker", description: "swinging_strike", release_speed: 93.7, release_pos_x: -2.04, release_pos_y: 54.25, release_pos_z: 5.49, vx0: 10.453006469526292, vy0: -136.1748397400469, vz0: -3.0311821839450257, ax: -18.522108280891747, ay: 28.092646657492587, az: -27.952742522924716, plate_x: 0.8941184258302919, plate_z: 2.363333700609703 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 46, pitch_number: 3, pitcher: 607074, player_name: "Wong, Connor", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "hit_into_play", release_speed: 94.4, release_pos_x: 1.96, release_pos_y: 54.21, release_pos_z: 6.24, vx0: -5.1699411392373955, vy0: -137.1880297884995, vz0: -7.289206062725017, ax: 11.586075314713002, ay: 33.837746259470194, az: -10.923825326087917, plate_x: 0.6807745005821056, plate_z: 2.563688329509448 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 54, pitch_number: 3, pitcher: 607200, player_name: "Suárez, Eugenio", pitch_type: "FC", pitch_name: "Cutter", description: "ball", release_speed: 90.5, release_pos_x: -1.12, release_pos_y: 53.88, release_pos_z: 5.94, vx0: 4.957622473662973, vy0: -131.88414693562513, vz0: -1.3148070227440836, ax: 3.223895268406028, ay: 25.870071883600428, az: -27.152224838307518, plate_x: 1.1560091144673899, plate_z: 3.415870554151028 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 6, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "ST", pitch_name: "Sweeper", description: "foul", release_speed: 82.8, release_pos_x: 2.75, release_pos_y: 54.17, release_pos_z: 5.23, vx0: -7.013765778267294, vy0: -120.41491356890504, vz0: -2.358222112752382, ax: -5.2300252214580665, ay: 24.457406857662534, az: -29.02491293821034, plate_x: -0.9126856363054705, plate_z: 1.591698602367027 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 48, pitch_number: 1, pitcher: 450203, player_name: "Arozarena, Randy", pitch_type: "CH", pitch_name: "Changeup", description: "ball", release_speed: 84.5, release_pos_x: -2.3, release_pos_y: 53.95, release_pos_z: 5.29, vx0: 7.438625934825982, vy0: -122.94646461379347, vz0: -2.7377583112384283, ax: -13.001395515579846, ay: 23.179285828067172, az: -31.88333112516777, plate_x: -0.09505354650828246, plate_z: 1.3975626362043134 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 46, pitch_number: 2, pitcher: 607074, player_name: "Wong, Connor", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "ball", release_speed: 93.8, release_pos_x: 2, release_pos_y: 54.21, release_pos_z: 6.24, vx0: -3.987923225948, vy0: -136.2909844239566, vz0: -8.330416233872059, ax: 12.707269952774402, ay: 31.575444960152023, az: -10.124862893304078, plate_x: 1.262994411540653, plate_z: 2.1867249617147837 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 54, pitch_number: 2, pitcher: 607200, player_name: "Suárez, Eugenio", pitch_type: "ST", pitch_name: "Sweeper", description: "swinging_strike", release_speed: 84.9, release_pos_x: -1.43, release_pos_y: 53.98, release_pos_z: 5.67, vx0: 4.418999726332792, vy0: -123.65558668806992, vz0: -4.248967339650272, ax: 10.46535263313537, ay: 23.359043245093748, az: -27.435881909300445, plate_x: 1.3813637285135774, plate_z: 1.5156492052694115 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 5, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "ball", release_speed: 92.8, release_pos_x: 2.43, release_pos_y: 54.12, release_pos_z: 5.33, vx0: -10.408428007167474, vy0: -134.7273024846078, vz0: -3.7097977153979476, ax: 13.06372418704402, ay: 28.221053599298628, az: -16.100274930229933, plate_x: -0.8810553452428638, plate_z: 2.6980033962715293 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 47, pitch_number: 4, pitcher: 450203, player_name: "Lowe, Josh", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "called_strike", release_speed: 93.5, release_pos_x: -2.19, release_pos_y: 54.25, release_pos_z: 5.41, vx0: 6.178787055613226, vy0: -136.07938158721564, vz0: -5.59539194156975, ax: -13.459184597994788, ay: 25.919736151728433, az: -20.24700755220221, plate_x: -0.6260055044064754, plate_z: 1.7886212422949734 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 46, pitch_number: 1, pitcher: 607074, player_name: "Wong, Connor", pitch_type: "CU", pitch_name: "Curveball", description: "ball", release_speed: 79.9, release_pos_x: 2.01, release_pos_y: 54.18, release_pos_z: 6.24, vx0: -5.12811537269232, vy0: -116.28243978856763, vz0: -4.1802774311558, ax: -4.344942910494068, ay: 23.63196650929357, az: -39.42825988943645, plate_x: -0.8238434148468119, plate_z: 0.5151965981250104 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 4, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "foul", release_speed: 92.9, release_pos_x: 2.44, release_pos_y: 54.23, release_pos_z: 5.35, vx0: -7.01420874013547, vy0: -135.25597405047873, vz0: -2.3838233052932325, ax: 8.747367730929122, ay: 26.992507746053228, az: -15.016855571512982, plate_x: 0.20565963183473024, plate_z: 3.348320368708474 },
  { game_pk: 747024, game_date: "2024-06-15", game_year: 2024, home_team: "BAL", away_team: "PHI", inning_topbot: "Top", at_bat_number: 54, pitch_number: 2, pitcher: 680570, player_name: "Schwarber, Kyle", pitch_type: "CU", pitch_name: "Curveball", description: "hit_into_play", release_speed: 80.9, release_pos_x: -2.5, release_pos_y: 53.03, release_pos_z: 5.59, vx0: 4.458137960410513, vy0: -117.72101894595392, vz0: -0.21181437155636185, ax: 3.656279003915328, ay: 24.634863540387244, az: -40.45112230515858, plate_x: -0.11627331906765292, plate_z: 1.7256820829416268 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 54, pitch_number: 1, pitcher: 607200, player_name: "Suárez, Eugenio", pitch_type: "FC", pitch_name: "Cutter", description: "called_strike", release_speed: 90.7, release_pos_x: -1.61, release_pos_y: 53.72, release_pos_z: 5.75, vx0: 5.163384335278999, vy0: -132.04778984386567, vz0: -3.8518943718377345, ax: 2.1255748775401804, ay: 25.314881276146007, az: -25.439086787418493, plate_x: 0.6597170733466056, plate_z: 2.325032916934228 },
  { game_pk: 746135, game_date: "2024-06-15", game_year: 2024, home_team: "LAD", away_team: "KC", inning_topbot: "Bot", at_bat_number: 51, pitch_number: 5, pitcher: 607625, player_name: "Biggio, Cavan", pitch_type: "CU", pitch_name: "Curveball", description: "called_strike", release_speed: 81.6, release_pos_x: -1.36, release_pos_y: 54.73, release_pos_z: 5.53, vx0: -0.5926172297320891, vy0: -118.7059135590078, vz0: 2.18863628742917, ax: 11.420302379096269, ay: 25.56239132722102, az: -44.40781074099369, plate_x: -0.5992642186420487, plate_z: 2.5034144057418874 },
  { game_pk: 747024, game_date: "2024-06-15", game_year: 2024, home_team: "BAL", away_team: "PHI", inning_topbot: "Top", at_bat_number: 54, pitch_number: 1, pitcher: 680570, player_name: "Schwarber, Kyle", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "ball", release_speed: 96.2, release_pos_x: -2.36, release_pos_y: 53.22, release_pos_z: 5.65, vx0: 4.282058979945858, vy0: -140.09069136799803, vz0: -1.4266428711737964, ax: -19.38593019649767, ay: 32.87940462766684, az: -16.380467522173255, plate_x: -1.9746476851727837, plate_z: 4.034083851024308 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 53, pitch_number: 5, pitcher: 607200, player_name: "McCarthy, Jake", pitch_type: "CH", pitch_name: "Changeup", description: "hit_into_play", release_speed: 87.8, release_pos_x: -1.65, release_pos_y: 53.83, release_pos_z: 5.82, vx0: 3.9529656704966607, vy0: -127.74513898154454, vz0: -4.750637232858825, ax: -12.788748455887907, ay: 25.5570717385963, az: -27.617292263793754, plate_x: -0.9628180415647252, plate_z: 1.6388390712964087 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 47, pitch_number: 3, pitcher: 450203, player_name: "Lowe, Josh", pitch_type: "CU", pitch_name: "Curveball", description: "foul", release_speed: 82.7, release_pos_x: -2.37, release_pos_y: 54.4, release_pos_z: 5.33, vx0: 5.3415657261871345, vy0: -120.47169194889196, vz0: 0.08913009706500863, ax: 12.78671850973321, ay: 22.854017276838242, az: -37.25024930655626, plate_x: 1.1893202245019434, plate_z: 2.106751598640526 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 3, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "ST", pitch_name: "Sweeper", description: "foul", release_speed: 82.8, release_pos_x: 2.83, release_pos_y: 54.23, release_pos_z: 5.27, vx0: -5.950206410602337, vy0: -120.54161897411834, vz0: 0.04219351149470507, ax: -5.815006223476587, ay: 23.599956581421722, az: -28.999221774539585, plate_x: -0.3941697589083716, plate_z: 2.743615145762363 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 39, pitch_number: 3, pitcher: 607074, player_name: "Devers, Rafael", pitch_type: "CU", pitch_name: "Curveball", description: "swinging_strike", release_speed: 80.6, release_pos_x: 1.84, release_pos_y: 54.27, release_pos_z: 6.31, vx0: -1.7287832065685713, vy0: -117.48438386325098, vz0: 1.020858791065858, ax: -6.532171101990861, ay: 21.619392561435504, az: -43.06906548887688, plate_x: 0.42825483434385525, plate_z: 2.8260340255215226 },
  { game_pk: 745329, game_date: "2024-06-15", game_year: 2024, home_team: "SF", away_team: "LAA", inning_topbot: "Bot", at_bat_number: 44, pitch_number: 2, pitcher: 663776, player_name: "Estrada, Thairo", pitch_type: "SL", pitch_name: "Slider", description: "hit_into_play", release_speed: 86.3, release_pos_x: 1, release_pos_y: 54.27, release_pos_z: 6.03, vx0: -1.475888952480498, vy0: -125.74084529854555, vz0: -5.477216853321344, ax: -5.2267751661136135, ay: 22.756236000820497, az: -25.30387334543513, plate_x: -0.05549291735239986, plate_z: 1.6302010608516904 },
  { game_pk: 746865, game_date: "2024-06-15", game_year: 2024, home_team: "CHC", away_team: "STL", inning_topbot: "Top", at_bat_number: 53, pitch_number: 2, pitcher: 684007, player_name: "Donovan, Brendan", pitch_type: "ST", pitch_name: "Sweeper", description: "swinging_strike", release_speed: 83.4, release_pos_x: 2.78, release_pos_y: 54.31, release_pos_z: 5.23, vx0: -8.036756154014222, vy0: -121.25713451790146, vz0: -1.8595632945385554, ax: -1.4249602390671057, ay: 24.36324818145145, az: -25.309427025713223, plate_x: -0.9942736822567476, plate_z: 2.1881703657398974 },
  { game_pk: 747113, game_date: "2024-06-15", game_year: 2024, home_team: "ATL", away_team: "TB", inning_topbot: "Top", at_bat_number: 47, pitch_number: 2, pitcher: 450203, player_name: "Lowe, Josh", pitch_type: "CU", pitch_name: "Curveball", description: "ball", release_speed: 81.9, release_pos_x: -2.3, release_pos_y: 54.25, release_pos_z: 5.28, vx0: 7.699873910807421, vy0: -119.05866108810713, vz0: -1.8456748058600014, ax: 11.697758409451597, ay: 23.56630857664227, az: -37.132210681518245, plate_x: 2.3058726089916712, plate_z: 1.0837926280387773 },
  { game_pk: 746946, game_date: "2024-06-15", game_year: 2024, home_team: "BOS", away_team: "NYY", inning_topbot: "Bot", at_bat_number: 39, pitch_number: 2, pitcher: 607074, player_name: "Devers, Rafael", pitch_type: "FF", pitch_name: "4-Seam Fastball", description: "foul", release_speed: 96, release_pos_x: 1.96, release_pos_y: 54.17, release_pos_z: 6.28, vx0: -4.617275396873339, vy0: -139.74478777844055, vz0: -5.875004694734204, ax: 10.877907256007418, ay: 31.5774312407889, az: -11.70033665819862, plate_x: 0.8585374881837664, plate_z: 3.216489560409925 },
  { game_pk: 747187, game_date: "2024-06-15", game_year: 2024, home_team: "AZ", away_team: "CWS", inning_topbot: "Bot", at_bat_number: 53, pitch_number: 4, pitcher: 607200, player_name: "McCarthy, Jake", pitch_type: "FC", pitch_name: "Cutter", description: "ball", release_speed: 91.6, release_pos_x: -1.53, release_pos_y: 53.77, release_pos_z: 5.84, vx0: 2.9434850814518523, vy0: -133.54173153484638, vz0: -0.7179261074946621, ax: 1.949413624852793, ay: 26.753517229762412, az: -25.752524518214752, plate_x: -0.19622069907517772, plate_z: 3.712795036768778 },
  { game_pk: 745329, game_date: "2024-06-15", game_year: 2024, home_team: "SF", away_team: "LAA", inning_topbot: "Bot", at_bat_number: 44, pitch_number: 1, pitcher: 663776, player_name: "Estrada, Thairo", pitch_type: "CH", pitch_name: "Changeup", description: "ball", release_speed: 84.3, release_pos_x: 0.96, release_pos_y: 54.22, release_pos_z: 6.04, vx0: -2.1805685046231296, vy0: -122.73410786593527, vz0: -1.8302134728473274, ax: 12.70295393901442, ay: 23.98776491174587, az: -21.933696468878406, plate_x: 1.0618124785017298, plate_z: 3.37036600484147 },
];

export type { NflPlay2024 } from "./plays.js";
/**
 * The 11,778 rush and pass plays of weeks 1 to 6 of the 2024 NFL regular season, from nflverse's
 * `pbp/play_by_play_2024.parquet` (the release asset NFL_TEAM_EPA_2024 is built from), as
 * tools/sample-data/nfl_plays_2024.py wrote them to fixtures/examples/nfl_plays_2024_wk1_6.json. Loaded on demand: the
 * file is half a megabyte, so only a page that shows the plays fetches it.
 */
export const nflPlays2024 = async (): Promise<readonly import("./plays.js").NflPlay2024[]> =>
  (await import("./plays.js")).NFL_PLAYS_2024;
