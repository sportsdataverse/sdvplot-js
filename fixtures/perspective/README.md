# Perspective parity fixture

`oracle.json` holds the answers of sdvplot's (Python) `perspective_sdv_config` on real frames. sdvplot-js's
`perspectiveConfig` must return each one exactly, key order included, and warn as often
(`packages/sdvplot/test/perspective-parity.test.ts`, which also pins this file's sha256). Never hand-edit it: a parity
failure is a port bug, or a difference between the two packages to report.

It also holds `table_theme_spec`'s answers on a few registry themes (`table_theme_specs`), every field, which
sdvtables' `tableThemeSpec` must return exactly (`packages/sdvtables/test/table-theme-spec.test.ts`, which also runs
the theme cases with the spec sdvtables resolves; the sdvplot parity test passes each theme case's recorded
`theme_spec`, since sdvplot cannot resolve a theme itself).

- **Written by** `tools/oracle/perspective.py`, run with the Python package's checkout beside this repo, in an
  environment of its own built from uv's cache with no download:
  `UV_PROJECT_ENVIRONMENT=<scratch>/pyenv uv run --project ../sdvplot --extra perspective --offline --frozen python tools/oracle/perspective.py`.
  The script refuses the network (any socket it opens raises). The sdvplot checkout is only read and run.
- **sdvplot:** commit `fc6c77add684a9698319c12f31e0548ae3bbc263` (0.1.1); `src/sdvplot/perspective.py` last changed
  in `519695e2ee4b968b76bd7f2e167116e8ab81ec8a`, `src/sdvplot/_table_themes.py` and its
  `data/table_themes.json` in `6c5d2050c071549df5937aefde868917dd2e6a4a` (the JSON's sha256 is sdvtables'
  `data/table_themes.json`'s, `041e0790…`); perspective-python 5.5.1; sdvplot index `0aeef853ec2b` (this repo's
  is `1c025b69f8cf`: every colour here still agrees). All recorded in `meta`.
- **Inputs (real frames):**
  - the 2024 NFL regular season by offence, from `fixtures/examples/nfl_epa_2024_reg.csv` (nflverse play-by-play):
    plays, EPA per play (`off_epa / off_plays`) and EPA per play allowed, best offence first;
  - the 2023-24 NBA Pacific Division, from `fixtures/examples/nba_leaguestandingsv3_2023_24_pacific.json`
    (stats.nba.com): numeric team ids, wins and the win percentage (× 100, named `win_pct`);
  - derived from the NFL frame: the best four with Baltimore's team missing (a null team), the best three with two
    values that name no NFL team ("XFL", "USFL"), and the best three with an empty `team_logo` column (a logo URL column
    needs the logo manifest, a network file, so it holds no URLs);
  - Python's own codepoint-order test frame of six college teams ("LSU" sorts before "Louisiana").
- **Cases (28):** the Datagrid, "Y Bar", "Y Line" and "X/Y Scatter"; light and dark; numeric team ids on the grid (one
  warning) and on bars; a null team on the grid, bars and a dark scatter; unresolved teams; formats (one replaced, one
  dropped) with a background; a logo column on the grid (a link) and on bars (none); a season; no rows (the NFL frame's columns, as
  Python keeps them: number formats and no palette) on the grid and on bars; a registry `theme` on the grid ("datagolf"
  light and dark, whose numeric face is its body face; "nfl-next-gen-stats" light and dark, Roboto Mono on the number
  columns; "ft-markets-data", light-only, with a logo link and a number column with no format; "datagolf" with numeric
  team ids, one warning) and on bars (which take none of it). Every registry theme has a body face, so the no-body-face
  branch has no case here (sdvplot's own test covers it with a literal spec).
- **Specs (9):** "datagolf" light and dark (native), "nfl-next-gen-stats" light and dark, "barrons-markets" dark
  (derived), "ft-markets-data" (light-only), "nejm" (a journal), "dunks-and-threes" dark and "evanmiya" (striped, with
  nested `heatColumns`).
- **Each case:** the options (Python's keyword arguments), the frame's schema as Perspective types, the rows, the
  config and the warnings' messages; with a `theme`, the spec it read (`theme_spec`).

Generated 2026-10-27 (theme cases and specs added the same day; the 21 earlier cases are unchanged). sha256
`198eb78458d168d7ac44ac7f1c7ba7791cc3771965822a3b5f70d4bfef05033b`.
