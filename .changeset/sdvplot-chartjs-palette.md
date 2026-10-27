---
"@sportsdataverse/sdvplot": minor
---

`@sportsdataverse/sdvplot/chartjs` adds `teamColorPalette(league, teams, o)`: one colour per team, in order, for `backgroundColor` / `borderColor`, with the shape of the other adapters' `teamColorPalette`. With `background`, every colour keeps 3:1 contrast against it and aims to stay CIE76 ΔE 20 from the others through the shared team palette (keeping the readable colour with one warning when it cannot); without it, the teams' own colours, and `fallback` (default `#808080`) for an unresolved team.
