---
"@sportsdataverse/sdvtables": minor
---

122 more table themes, each named after the source it is styled on (`datagolf`, `basketball-reference`, `wikipedia`, `economist`, `nejm`, `espn-site`, ...), from a survey of newsroom, sports-stats, finance, journal, government and table-library tables. Use one by name like any other theme (`theme: { name: "datagolf", options: { mode: "dark" } }`); `mode: "dark"` works for the 98 themes with a dark version and raises a clear error naming dark alternatives for the rest. `listTableThemes()` lists them with their category and dark support. House themes and the `fmtr-*` reactablefmtr ports keep precedence over registry names. Faces load from Google Fonts with a serif, monospace or sans-serif fallback, and an unknown theme name now suggests close matches. The registry ships as `data/table_themes.json` and is shared byte-for-byte with sdvplot (Python) and sdvplotR.
