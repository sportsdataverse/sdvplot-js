---
"@sportsdataverse/sdvplot": minor
---

`@sportsdataverse/sdvplot/chartjs` adds `teamColorPalette(league, teams, o)`: one colour per team for `backgroundColor` / `borderColor`, as every other adapter's `teamColorPalette`. With `background`, every colour keeps 3:1 contrast against the chart's background and aims to stay CIE76 ΔE 20 from the others through the shared team palette (keeping the readable colour with one warning when it cannot), so a dark Chart.js chart, or a react-chartjs-2 one, stays readable. The Chart.js helpers are now tested through react-chartjs-2 (5.3.1): first render, prop updates in place and unmount; the docs gain a react-chartjs-2 guide.
