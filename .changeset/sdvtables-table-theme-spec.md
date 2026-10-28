---
"@sportsdataverse/sdvtables": minor
---

`tableThemeSpec(name, mode?)` resolves a registry table theme (`datagolf`, `nejm`, ...) to its fonts, sizes, complete palette and structure (every `{key}` in a border string taken from the palette), as sdvplot (Python)'s `table_theme_spec` does: the same fields (`dark_policy` is `darkPolicy`) and the same values, checked against a fixture the Python package wrote. It throws a `TableSpecError` for an unknown name (with close matches), a reactablefmtr port name ("espn", "fivethirtyeight", "pff"), an unknown mode, or "dark" on a light-only theme. Its result is the `theme` of sdvplot's `perspectiveConfig`. New types: `TableThemeSpec`, `TableThemePaletteKey`.
