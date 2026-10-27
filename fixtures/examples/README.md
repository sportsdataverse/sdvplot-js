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

`examples/src/data.ts` `NFL_TEAM_EPA_2024` is every row of `nfl_epa_2024_reg.csv`, and `KC_PHI_GAMES_2024` the 34 rows
of `nfl_games_2024_reg.csv` with KC or PHI as the home or away team (id, week, teams and scores).

- `nfl_plays_2024_wk1_6.json`: written by `uv run tools/sample-data/nfl_plays_2024.py --pbp <file>` from the same
  release asset, `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2024.parquet`
  (fetched 2026-10-27, 20,597,560 bytes, sha256 `3fd2896bc0b911b615142d2f1fabae54a4bbba5ab7b73b28187b118ef8af6a3b`,
  Last-Modified 2026-08-13). The script stops unless the file has that sha256 (its `PBP_SHA256`), then rebuilds
  `nfl_epa_2024_reg.csv` from it and stops unless every value matches, so the plays are the ones that table counts. It
  writes the 11,778 of them in weeks 1 to 6 (92 games) in the release's order, as columns: `games` and `teams` are
  lookup lists that `game` and `posteam` index, `epa` is rounded to 4 decimals and `wp` to 3, and every other value is
  as served. 544,192 bytes, sha256
  `31e1ab9c114e5ec99082e6db0cadb5a9a3bc05a515ae621fc60c6c88322ecf8c`. `examples/src/plays.ts` turns the columns back
  into rows (`defteam` is the game's other team), and `examples/src/data.ts` `nflPlays2024()` loads them on demand.

## NFL stadiums and airports

Written by `uv run tools/sample-data/nfl_venues.py --stadiums ... --games ... --airports ...` from local checkouts
(nothing downloaded), 2026-10-27:

- `nfl_stadiums_2024.csv` (`NFL_STADIUMS_2024`, 1,659 bytes, sha256 `b1a6a216…1260`): each team's 2024 home stadium
  and its coordinates.
  - The stadium is the `stadium_id` of most of the team's 2024 regular-season home games, joined by id, not name,
    in nflverse `games.csv`, read from nflverse/nfldata `data/games.csv` at 20cdb994b1. The script asserts that
    file's 272 games of 2024 equal `nfl_games_2024_reg.csv`.
  - The stadium's row comes from sportsdataverse/nfl-data `nfl/stadiums/stadiums.csv` at main 8c8305af
    (sportsdataverse/nfl-data#85). That file is a verbatim copy of nfelo's greerreNFL/Stadiums `data/stadiums.csv`
    at upstream commit 3e97318781f198973e1414189d6324249657f562: 51,180 bytes, sha256
    `c73bc82fdcb5abe9018227a61bfe91a562d7bf1f10214ee34f1a480d5bcd519c`, which the script asserts. Columns kept:
    `team`, `stadium_id`, `stadium_name`, `lat`, `lon`, values as served (Houston's stadium is still named
    "Reliant Stadium" there).
  - Upstream declares no licence. The owner approved its use (2026-10-27), and the guide credits nfelo (greerreNFL).
- `nfl_airports.csv` (`NFL_AIRPORTS`, 760 bytes, sha256 `0e19429b…182b`): each team's home airport, every row of
  nflverse/nfldata `data/airports.csv` (sha256 `677cb0e9…d6f7`, last changed de2c0016d5 of 2020-07-13; read at
  20cdb994b1). Columns kept: `team`, `airport`, `latitude`, `longitude`, values as served. The MapLibre road-trip
  and arc examples fly teams airport to airport.

## Captures from sportsdataverse-py

Written by `uv run tools/sample-data/sdv_py_captures.py` from fixtures committed in sportsdataverse-py
(`tests/fixtures/`, read at sportsdataverse-py 82249b4, 2026-10-07). Each file keeps whole records only, every kept
record unchanged (the one exception, the win-probability file's plays, says so); `examples/src/data.ts` holds them with
columns renamed, and `examples/test/sample-data.test.ts` checks the two are equal.

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
- `espn_nfl_summary_401671889_wp.json` (`SUPER_BOWL_LIX_WP`): the same game summary, from the same
  `espn/summary_nfl.json` (sha256 `a5d1837cac50162d0a74ec97ecdada7d2dc53f8e50f7fb54e2dad007be870b40`, last changed in
  sportsdataverse-py 755f9e4 of 2026-05-24; read at 29d2006, 2026-10-08). Trimmed: `winprobability` keeps all 187
  entries, unchanged; `plays` holds all 186 plays of `drives.previous[].plays[]`, each cut to `id`, `period.number` and
  `clock.displayValue`. The test joins each entry to its play by `playId` (one pregame entry has none) and turns the
  play's period and clock into minutes played, rounded to 0.01.
- `espn_nfl_summary_401671889_drives.json` (`SUPER_BOWL_LIX_DRIVES`): the same game summary, from the same
  `espn/summary_nfl.json` (sha256 above). Trimmed: `header` as in the touchdown file; `drives` holds all 26 drives of
  `drives.previous[]`, each cut to `id`, `team.id`/`team.abbreviation`, `start.yardLine`/`start.text`, `result` and
  `displayResult`. ESPN counts `start.yardLine` from Philadelphia's (the home team's) goal line; the data module turns
  it into yards from the offence's goal (nflverse's `yardline_100`), and the test checks that against `start.text`.
- `espn_nfl_summary_401671889_kc_passing.json` (`SUPER_BOWL_LIX_KC_TARGETS`, `SUPER_BOWL_LIX_KC_PASSER`): the same
  game summary, from the same `espn/summary_nfl.json`. Trimmed: the Chiefs' `boxscore.players[]` entry, cut to its
  `team.id`/`team.abbreviation` and its `passing` and `receiving` statistics, each unchanged. Patrick Mahomes is the one
  passer (21 of 32), and the nine receivers' targets add up to 32: the test checks both.
- `pwhl_pbp_42_shots.json` (`PWHL_GOALS`): HockeyTech `statviewfeed/gameCenterPlayByPlay`, PWHL game 42, PWHL Boston
  at PWHL Montreal, 2024-03-02 (Montreal won 3-1, per sportsdataverse-py's `hockeytech/pwhl_game_summary_42.json`).
  From `hockeytech/pwhl_pbp_42.json` (173 events). Trimmed: the 70 events whose `event` is `shot` or `goal`; the data
  module takes the 4 goals, and the test reads every event's `xLocation`/`yLocation` to pin the canvas size.

## 2018 World Cup final passes (StatsBomb open data)

`spadl_8658_france_h1_passes.csv` (`WC2018_FINAL_FRANCE_PASSES`): France's completed first-half passes in the 2018
World Cup final (StatsBomb open-data match 8658, France 4-2 Croatia), trimmed by `tools/sample-data/sdv_py_captures.py`
from sportsdataverse-py's `tests/fixtures/socceraction/8658_spadl.csv` (socceraction 1.5.3's direct StatsBomb
converter, every action attacking left to right on a 105 x 68 m pitch; frozen 2026-10-07, sha256
`aba3c8cbb4770631997828d9006ec5f68bac3525363521583d1a0c6228bbdd58`, last changed in sportsdataverse-py 35776ac; read at
29d2006, 2026-10-08). Kept: `team_id` 771, `period_id` 1, `type_name` pass, `result_name` success (75 rows, each
unchanged, with the header). StatsBomb's terms (<https://github.com/statsbomb/open-data>, README "Terms & Conditions" and
`LICENSE.pdf` clause 1.4, read 2026-10-08) ask that published work state StatsBomb as the source and show the
StatsBomb logo. The example that draws it (`sporty/plot/pass-map`) names StatsBomb in its caption, and its `statsbomb`
tag makes the docs' `<Live>` show the logo, linked to <https://statsbomb.com>, with "Data: StatsBomb open data".

`statsbomb_8658_france_h1_pass_recipients.csv` (`WC2018_FINAL_FRANCE_RECIPIENTS`): who passed and who received each of
those 75 passes, written by `tools/sample-data/statsbomb_8658_recipients.py` from StatsBomb open data at commit
`e3355d71f961dc88123d4c63655f37341c8c3957` (2023-07-26, the last to change match 8658's events and lineups; fetched
2026-10-18): `data/events/8658.json` (sha256 `a9aa72c042153fa351c3591ee11e7fba95b0c8841c4489da4aa6809de1edbdf5`) and
`data/lineups/8658.json` (sha256 `84696fa0d36f14e6aa557d9dcdf11f4ac0f304e6e7a547bb160f740f85a71f53`). Per SPADL row, in
its order: `action_id` and `original_event_id` copied from `spadl_8658_france_h1_passes.csv`; `player_id` (the event's
`player.id`, checked equal to SPADL's) and `recipient_id` (`pass.recipient.id`) from the event with that id; each name the
lineup's `player_nickname`, or its `player_name` where the nickname is null. 75 rows with the header, as served. The
example that draws it (`sdvplot/cytoscape/france-pass-network`) credits StatsBomb as above.

`docs/static/img/statsbomb-logo.png`: StatsBomb's logo, from the open-data repository's
`img/SB - Icon Lockup - Colour positive.png` (<https://github.com/statsbomb/open-data/tree/master/img>, last changed in
3bfc16d, 2022-03-03; fetched 2026-10-08; 5885 x 943 PNG, 120,793 bytes, sha256
`8ba5480785f0dc4be2342ec47c70509483eb79287f85f92be1dfba36fc2872a7`). That directory holds only this PNG, no SVG. The
docs draw it at 100 x 16, so the committed copy is that file resized to twice that, 200 x 32 (the source's aspect,
rounded to whole pixels), with Pillow 12.3's Lanczos filter (`reducing_gap=3.0`), then saved as an optimised RGBA PNG
(`optimize=True`, `compress_level=9`; its 1,112 colours rule out a lossless palette): 9,986 bytes, sha256
`23f55187241a7bf12f7c9711f449973379b2056e94ebbeb5bf79bbda723d81fe`. The artwork is unchanged. Used only as that
credit, as the terms ask.

## Statcast pitches (Baseball Savant)

- `mlb_statcast_search_2024-06-15_head.csv` (`STATCAST_PITCHES_2024_06_15`): Baseball Savant's pitch-level search for
  2024-06-15, the header (119 columns) and its first 46 pitches, byte for byte (UTF-8 BOM and Savant's quoting kept).
  Copied unchanged by `tools/sample-data/sdv_py_captures.py` from sportsdataverse-py's
  `tests/fixtures/mlb_statcast/search_2024-06-15_head.csv` (captured 2026-09-17 from
  `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&game_date_gt=2024-06-15&game_date_lt=2024-06-15`,
  the request `mlb_statcast_search("2024-06-15", "2024-06-15")` sends; last changed in sportsdataverse-py 6678b0f, read
  at b4229f1, 2026-10-18; sha256 `f605ab3da13670a78f53286484758505a4fe78d95a9730bce4a8de8d94248608`, which the tool
  checks). The pitches span 7 games. `examples/src/data.ts` holds every row with the columns the 3D examples read.
- `mlb_statcast_search_2026-06-15_head.csv`: the same search for 2026-06-15, the header and its first 5 pitches, byte
  for byte. Captured 2026-10-19 with `curl` from
  `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&game_date_gt=2026-06-15&game_date_lt=2026-06-15`
  (2,791 pitches in the response; its first 6 lines kept); sha256
  `df1e2f7fa36a18c79c87efaf0a28697cfe112aa52c47f9389107c8efe340c56d`. Savant's CSV documentation
  (<https://baseballsavant.mlb.com/csv-docs>, read 2026-10-19) says `plate_x`/`plate_z` are measured at the front of
  home plate through 2025 and at its middle from 2026; sdvplot's `test/three.test.ts` holds `statcastPitchPath` to
  Savant's own release point on these 2026 pitches and on the 2024 ones.

Statcast data is MLB Advanced Media's, published on Baseball Savant; the 3D example names Baseball Savant as its source.
Data © MLB Advanced Media, L.P. Use is subject to MLB's terms of use: <https://www.mlb.com/official-information/terms-of-use>.
