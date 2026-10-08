# 2024 NFL season sources

The rows of `../nfl-2024.ts` (`NFL_2024`, the `many` fixture of `../engine.ts`) come only from these files;
`test/nfl-2024.test.ts` re-derives every value from them. No value is hand-written.

- `nfl_games_2024_reg.csv`, `nfl_qb_espn_ids_2024.csv`, `nfl_epa_2024_reg.csv`: byte-identical copies of
  `fixtures/examples/` on `feat/docs-live` at `d017fb0` (sha256 prefixes `3265bb4f3398d573`, `6147da56d67f755f`,
  `aee8d98b7fa1f641`). That branch's `tools/sample-data/nfl_2024.py` wrote them from nflverse-data release assets
  fetched 2026-10-08:
  - games: the 272 games of the 2024 regular season from `schedules/games.csv`: id, week, scores and each side's
    starting quarterback, values as served;
  - qb ids: `gsis_id`, `display_name` and `espn_id` from `players/players.csv` for every quarterback who started a
    2024 regular-season game;
  - epa: per team, the number and summed EPA of its offensive plays and of the plays its defence faced, from
    `pbp/play_by_play_2024.parquet` (regular season, `pass == 1 | rush == 1`, `epa` not null; sums rounded to 6
    decimals).
- `nfl_divisions.csv`: a byte-identical copy of sportsdataverse-py `tests/fixtures/seedr/divisions.csv` (`bf28e99c12`,
  sha256 prefix `d1ccd27a27b6958e`), which is `nflseedR::divisions` (nflseedR 2.0.2, captured 2026-07-03): team,
  conference and division for all 32 teams plus four relocated abbreviations (OAK, SD, STL, LAR) no 2024 game uses.

The `qb` column is the starter `games.csv` credits most often, as served. Where nflverse's starter field is itself off,
the fixture keeps it: `games.csv` names Andy Dalton for Carolina's weeks 10, 12, 13 and 14 (checked against the live
asset 2026-10-08), so `CAR` lists Dalton (9 starts to Bryce Young's 8).
