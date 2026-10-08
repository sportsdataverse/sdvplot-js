---
"@sportsdataverse/sdvplot": patch
---

`sdvplot/plotly` `withAxisLogos`: hovering a bar names its team again (it read "(, 15)"). Plotly builds a category's hover label from its tick text, so the drawn labels are now hidden with `showticklabels: false` rather than blanked. With an unresolved team on the axis, only that team keeps a tick; the drawn ones lose their tick marks and grid lines, which are off by default on a category axis. New `PlotlyAxis.showticklabels` field.
