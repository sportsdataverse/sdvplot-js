---
"@sportsdataverse/sdvplot": minor
---

`sdvplot/plotly`, `sdvplot/vega`, `sdvplot/echarts`: spec adapters with no runtime dependency (`withLogos`, `withWordmarks`, `withHeadshots`, `withAxisLogos`, team colour helpers, `embedSources`). They return a new spec and never mutate yours (`checkAdapterContract` in `sdvplot/testing` checks this for any adapter).

- The images they add stay out of your tooltips: ECharts helper series set `tooltip: { show: false }`, so an axis tooltip lists only your own series; Vega image layers set `tooltip: null`, which outranks `config.mark.tooltip` and a parent `encoding.tooltip`.
- Each Vega image layer carries a description ("KC logo") rather than reading out its URL or data URI.
- Plotly `withAxisLogos` hides the drawn tick labels with `showticklabels: false`, so hovering a bar still names its team; an unresolved team keeps its text tick.
