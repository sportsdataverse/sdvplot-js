---
"@sportsdataverse/sdvplot": patch
---

`sdvplot/echarts`: a `tooltip: { trigger: "axis" }` tooltip lists only the chart's own series again. The series that sdvplot adds (`withAxisLogos`, `withLogos`, `withWordmarks`, `withHeadshots`) each added a stray row: a `-` from the axis-logo series, and the bare value from a mark series. Each of those series now carries `tooltip: { show: false }`, the setting ECharts checks when it builds an axis tooltip (`silent` is not checked). Item tooltips, the drawn images and the caller's series and tooltip options are unchanged. `LogoSeries` gains a `tooltip` field.
