---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/uplot`: `withTeamSeries` strokes (and with `fill`, fills) each uPlot series in its team's colour, keeping 3:1 contrast against a `background` for dark mode and every team distinct (CIE76 ΔE of 10 or more), and `logoPlugin` is a uPlot plugin that paints team logos on the canvas at data points in its `draw` hook (sized as a fraction of the plot area; a team with no logo, or an image that fails to load, draws nothing and warns once; rows can be a function of the chart, so end logos follow live `setData`). `drawnMarks` reads back what the plugin drew. It never imports uplot, a new optional peer (>= 1.6.31).
