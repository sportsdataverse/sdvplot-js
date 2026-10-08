# Example fixtures

Real bytes the examples use: images the gate serves to `network`-tagged examples (`examples/test/run.ts` `FIXTURES`),
so an example that fetches still runs offline, and the captures the shared sample data is checked against
(`examples/test/sample-data.test.ts`). Nothing here is hand-written; where a file is a trimmed capture, its entry says how.

## Images

- `<sha256>.png`: team marks as the sdvplot archive serves them,
  `https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/<first 2>/<sha256>.png`, the URL `logoUrlSync` /
  `placeSync` returns. The name is the sha256 of the file (`examples/test/run.test.ts` checks it).
  - `3d77958d….png`: KC (nfl) logo, 500 × 500, 40,228 bytes. Fetched 2026-10-08.
  - `5400f85b….png`: LAC (nfl) logo, 500 × 500, 32,850 bytes. Fetched 2026-10-08.
  - `c98bec2b….png`: DEN (nfl) logo, 500 × 500, 40,948 bytes. Fetched 2026-10-08.
  - `25fbb03e….png`: LV (nfl) logo, 500 × 500, 77,766 bytes. Fetched 2026-10-08.
  - `2875f50f….png`: PHI (nfl) logo, 500 × 500, 70,332 bytes. Fetched 2026-10-08.
  - `16a2c7e0….png`: KC (nfl) wordmark, 700 × 192, 12,907 bytes. Fetched 2026-10-08.
  - `ad87ef1e….png`: LAC (nfl) wordmark, 701 × 193, 20,540 bytes. Fetched 2026-10-08.
  - `ddced0c3….png`: DEN (nfl) wordmark, 701 × 192, 14,677 bytes. Fetched 2026-10-08.
  - `c22afa54….png`: LV (nfl) wordmark, 701 × 192, 6,794 bytes. Fetched 2026-10-08.
- `espn-headshot-nfl-<espn id>-96x70.png`: ESPN headshots as the image combiner serves them at 96 × 70,
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/<id>.png&w=96&h=70` (the URL `headshotUrl`
  returns, plus the size the `chartjs/headshot-points` example asks for). Fetched 2026-10-08 (Last-Modified
  2026-10-07): Patrick Mahomes 3139477, Justin Herbert 4038941, Bo Nix 4426338, Gardner Minshew 4038524.

## NBA shots

`nba_shotchartdetail_0022300061_q4.json`: stats.nba.com `shotchartdetail` for the Lakers at the Nuggets on
2023-10-24 (game 0022300061; Denver won 119-107, per the line score in sportsdataverse-py's captured
`boxscoresummaryv2`), every field-goal attempt by either team. Captured 2026-10-08 with sportsdataverse-py
`nba_stats_shotchartdetail(game_id_nullable="0022300061", player_id="0", team_id="0", season_nullable="2023-24",
context_measure_simple="FGA", return_parsed=False)` (181 rows). Trimmed: `Shot_Chart_Detail` keeps only the rows with
`PERIOD` 4 (38 rows, each unchanged) and the `LeagueAverages` result set is dropped; `resource` and `parameters` are as
served. `examples/src/data.ts` `NBA_SHOTS` is these rows with the columns renamed.

## 2024 NFL season (nflverse)

Written by `uv run tools/sample-data/nfl_2024.py` from nflverse-data release assets (fetched 2026-10-08):

- `nfl_games_2024_reg.csv`: the 272 games of the 2024 regular season from `schedules/games.csv`: id, week, scores and
  each side's starting quarterback, values as served.
- `nfl_qb_espn_ids_2024.csv`: `gsis_id`, `display_name` and `espn_id` from `players/players.csv` for every
  quarterback who started a 2024 regular-season game.
- `nfl_epa_2024_reg.csv`: per team, the number and summed EPA of its offensive plays and of the plays its defence
  faced, from `pbp/play_by_play_2024.parquet` (regular season, `pass == 1 | rush == 1`, `epa` not null; sums rounded to
  6 decimals).

## Captures from sportsdataverse-py

Written by `uv run tools/sample-data/sdv_py_captures.py` from fixtures committed in sportsdataverse-py
(`tests/fixtures/`, read at sportsdataverse-py 82249b4, 2026-10-07). Each file keeps whole records only, every kept
record unchanged; `examples/src/data.ts` holds them with columns renamed, and `examples/test/sample-data.test.ts`
checks the two are equal.

- `nba_leaguestandingsv3_2023_24_pacific.json` (`NBA_STANDINGS`): stats.nba.com `leaguestandingsv3`, Season 2023-24,
  Regular Season: the final 2023-24 standings. From `nba_stats/leaguestandingsv3_2023_24.json` (sportsdataverse-py
  `nba_stats_leaguestandingsv3(season="2023-24", return_parsed=False)`, captured 2026-07-08, 30 rows). Trimmed:
  `Standings` keeps the 5 rows whose `Division` is `Pacific`.
- `nhl_standings_20252026_atlantic.json` (`NHL_STANDINGS`): NHL api-web `/v1/standings/now`, the final 2025-26
  regular-season standings (rows dated 2026-04-17, 82 games each; `standingsDateTimeUtc` 2026-05-25T00:38:00Z). From
  `nhl_api_web/standings_now.json` (captured 2026-05-24, 32 rows). Trimmed: `standings` keeps the 8 rows whose
  `divisionName` is `Atlantic`.
- `nhl_pbp_2023030417_p1_shots.json` (`NHL_SHOTS`): NHL api-web `/v1/gamecenter/2023030417/play-by-play`, game 7 of
  the 2024 Stanley Cup Final, Edmonton at Florida, 2024-06-24 (Florida won 2-1). From `nhl_api_web/pbp_2024_scf_g7.json`
  (captured 2026-05-24, 331 plays). Trimmed: keeps `id`, `season`, `gameType`, `gameDate`, `awayTeam` and `homeTeam`,
  and the 27 `plays` of period 1 whose `typeDescKey` is `goal`, `shot-on-goal` or `missed-shot`.
- `espn_nfl_summary_401671889_offense_tds.json` (`SUPER_BOWL_LIX_TDS`): ESPN Site v2 `summary?event=401671889`,
  Super Bowl LIX, Kansas City at Philadelphia, 2025-02-09 (Philadelphia won 40-22). From `espn/summary_nfl.json`.
  Trimmed: `header` keeps only `id` and each competitor's `homeAway` and `team.id`/`team.abbreviation`; `plays` are
  the 6 plays from `drives.previous[].plays[]` whose `type.text` is `Rushing Touchdown` or `Passing Touchdown`.
- `pwhl_pbp_42_shots.json` (`PWHL_GOALS`): HockeyTech `statviewfeed/gameCenterPlayByPlay`, PWHL game 42, PWHL Boston
  at PWHL Montreal, 2024-03-02 (Montreal won 3-1, per sportsdataverse-py's `hockeytech/pwhl_game_summary_42.json`).
  From `hockeytech/pwhl_pbp_42.json` (173 events). Trimmed: the 70 events whose `event` is `shot` or `goal`; the data
  module takes the 4 goals, and the test reads every event's `xLocation`/`yLocation` to pin the canvas size.
