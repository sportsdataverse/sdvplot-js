---
"@sportsdataverse/sdvplot": patch
---

`sdvplot/vega`: the image layers sdvplot adds (`withLogos`, `withWordmarks`, `withHeadshots`, `withAxisLogos`, `logoLayer`) never show a tooltip. When a spec turned tooltips on for every mark (`config: { mark: { tooltip: true } }`, `{ content: "data" }` or `config.image.tooltip`), hovering a logo showed its row: the team, `sdvplot_url` (a whole data URI under `embedSources`) and `sdvplot_label`. A `logoLayer` placed under a layer list's own `encoding.tooltip` inherited that tooltip too. Each image layer now sets `tooltip: null` on its mark, which outranks the config, and on its encoding, which outranks a parent's `encoding.tooltip`. The caller's marks keep their tooltips, the images draw as before, and they stay non-interactive under a selection. `ImageLayer.mark` gains `tooltip: null`.
