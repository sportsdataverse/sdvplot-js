# Shared team palette: Python oracle

`oracle.json` holds the colours sdvplot (Python) gives for 37 lists of team values, and
`packages/sdvplot/test/palette-parity.test.ts` holds `colorPalette` (`packages/sdvplot/src/_web.ts`, behind every
adapter's `teamColorPalette`) to them exactly. Never hand-edit it: a parity failure is a difference between the two
languages.

- **Python functions:** `sdvplot.perspective._palette` (the primary colour: resolve, the palette over the distinct
  resolved teams, unresolved values grey and out of the palette) for 25 cases, and `sdvplot.pydeck._end_colors`
  (`which`, and no background) over distinct values for 12.
- **Inputs (real team values from the index):** every NFL team by abbreviation on `#ffffff`, `#181a1b`, `#000000`
  and `#242526`; every NBA, MLB and NHL team by team id on `#ffffff` and `#181a1b`; aliases of one team (`"KC"`, `12`,
  `"Kansas City Chiefs"`; `"LA"`, `"Los Angeles Rams"`) and a repeated value; unresolved values (`"XFL"`, `"USFL"`,
  `99999`) before and after every NFL team; relocated codes (`OAK`, `SD`, `STL`) in 2015 and 2024; ESPN ids under
  `idSystem: "espn"`; NBA ids, abbreviations and names mixed; the first 60 college football teams; Towson and Ithaca
  (no secondary colour) with `which: "secondary"`.
- **Provenance:** sdvplot 0.1.1, commit fc6c77ad, index `0aeef853ec2b` (this repo's index is `1c025b69f8cf`; no
  colour in these cases differs). sha256 `f0c5ef59…`, pinned in the test.
- **Command** (run 2026-10-27, offline: uv's cache only, and the script makes any socket raise; the sdvplot checkout
  is only read):

  ```sh
  UV_PROJECT_ENVIRONMENT=<short path>/pyenv uv run --project ../sdvplot --extra perspective --extra pydeck \
    --offline --frozen python tools/oracle/palette.py
  ```

  On Windows keep the environment path short: Pillow's DLL fails to load under a long one.
