/**
 * Real sample rows the examples share (spec §7: real fixtures, never synthetic). Examples import them as
 * `@sportsdataverse/examples/data`; the "Sample data" page prints them.
 */
export { STANDINGS } from "../../packages/sdvtables/test/fixtures/standings.js";
export type { Standing } from "../../packages/sdvtables/test/fixtures/standings.js";

/**
 * Super Bowl LIX (Kansas City at Philadelphia, 2025-02-09; PHI won 40-22): ESPN's home (PHI) win probability after
 * each of 186 plays, against minutes played (the play's start clock). Real: ESPN Site v2 `summary?event=401671889`,
 * `winprobability` joined to `drives.previous[].plays[]` by `playId` (one pregame row has no play), as captured in
 * sportsdataverse-py `tests/fixtures/espn/summary_nfl.json`.
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
