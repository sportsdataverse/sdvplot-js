---
"@sportsdataverse/sdvplot": patch
---

The shared team palette behind `teamColorPalette` (recharts, victory, chartjs, svelte, tanstack, g2, mui, unovis) and MapLibre's `routeLines` now follows the Python package's rule: aliases of one team share one colour, and unresolved teams no longer shift other teams' colours. Each value is resolved to its team first, so `"KC"`, `12` and `"Kansas City Chiefs"` are one team with one colour on a `background`; a value that does not resolve takes `fallback` (one warning) and no place in the palette. A team with no colour for `which` (often no secondary) now takes its other colour, not `fallback`.
