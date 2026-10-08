---
"@sportsdataverse/sdvplot": minor
---

`sdvplot/chartjs`: a `loadImage` option on every image helper (`logoPoints`, `wordmarkPoints`, `headshotPoints`, `axisLogos`, `logoWatermarks`) loads the marks through your own loader instead of a DOM image, so they render in Node on `@napi-rs/canvas` (pass its `loadImage`). Images that land after a draw redraw the chart, and a chart destroyed first is left alone; without `loadImage` nothing changes. New type `ImageLike`.
