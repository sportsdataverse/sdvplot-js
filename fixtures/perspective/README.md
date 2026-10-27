# Perspective parity fixture

`oracle.json` holds the answers of sdvplot's (Python) `perspective_sdv_config` on real frames. sdvplot-js's
`perspectiveConfig` must return each one exactly, key order included, and warn as often
(`packages/sdvplot/test/perspective-parity.test.ts`, which also pins this file's sha256). Never hand-edit it: a parity
failure is a port bug, or a difference between the two packages to report.

- **Written by** `tools/oracle/perspective.py`, run with the Python package's checkout beside this repo, in an
  environment of its own built from uv's cache with no download:
  `UV_PROJECT_ENVIRONMENT=<scratch>/pyenv uv run --project ../sdvplot --extra perspective --offline --frozen python tools/oracle/perspective.py`.
  The script refuses the network (any socket it opens raises). The sdvplot checkout is only read and run.
- **sdvplot:** commit `fc6c77add684a9698319c12f31e0548ae3bbc263` (0.1.1); `src/sdvplot/perspective.py` last changed
  in `519695e2ee4b968b76bd7f2e167116e8ab81ec8a`; perspective-python 5.5.1; sdvplot index `0aeef853ec2b` (this repo's
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
- **Cases (19):** the Datagrid, "Y Bar", "Y Line" and "X/Y Scatter"; light and dark; numeric team ids on the grid (one
  warning) and on bars; a null team on the grid, bars and a dark scatter; unresolved teams; formats (one replaced, one
  dropped) with a background; a logo column on the grid (a link) and on bars (none); a season.
- **Each case:** the options (Python's keyword arguments), the frame's schema as Perspective types, the rows, the
  config and the warnings' messages.

Generated 2026-10-27.
