---
"@sportsdataverse/sdvplot": minor
---

`perspectiveConfig` takes a `theme`, best as a function of the mode (`(m) => tableThemeSpec(name, m)` from sdvtables, called with the call's own `mode` on every plugin, so a light-only theme in dark mode throws) or a `PerspectiveTheme` spec, as Python's `perspective_sdv_config(theme=...)` does: on the Datagrid, the theme's body face and size (`plugin_config`), its sign colours on every number column (`fg_color`) and, when its numeric face is not the body face, that face on the number columns (`font_family`). A chart takes none of it. Any other `theme` value (a theme name, `null`) is an `InputError`. The output equals Python's, key order included (parity fixture `fixtures/perspective/oracle.json`, now 28 cases).
