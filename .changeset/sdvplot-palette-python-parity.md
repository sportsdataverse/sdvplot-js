---
"@sportsdataverse/sdvplot": patch
---

The shared team palette now follows the Python package's rule: aliases of one team share one colour, and unresolved teams no longer shift other teams' colours. This covers `teamColorPalette` (recharts, victory, chartjs, svelte, tanstack, g2, mui, unovis), MapLibre's `routeLines`, uplot's `withTeamSeries` and nivo's `teamColors`. Each value is resolved to its team first, so on a `background` `"KC"`, `12` and `"Kansas City Chiefs"` are one team with one colour and one place in the palette (uplot gave each alias its own colour; nivo drew them alike but gave each a palette slot). A value that does not resolve takes `fallback` (one warning) and no place in the palette. A team with no colour for `which` (with `which: "secondary"`, the 794 teams that have no secondary colour, in college, minor-league and soccer leagues) now takes its other colour instead of the grey fallback, as Python does, with or without a `background`.
