---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/victory`: `teamTheme`, a Victory theme from team colours (the teams' colours as every group, stack, pie and legend `colorScale`, the first team's for a lone line, area, bar or scatter, built over a `base` theme such as `VictoryTheme.clean`), and `teamColorPalette`, the same colours as a `colorScale` list (with `background`, every colour keeps 3:1 contrast and stays distinct from the others, CIE76 ΔE 20 or more, for dark mode); plus `embedSources`. It never imports victory: `victory` is a new optional peer (>= 37.3.6). `sdvplot/react` adds `<LogoPoint>`, team logos as a `VictoryScatter`'s points (each as tall as the point it replaces), and `<LogoTick>`, team logos as a `VictoryAxis`' tick labels (`size` px tall); a label with no logo keeps its text, drawn by Victory's `VictoryLabel`, which `<LogoTick>` loads from victory only then.
