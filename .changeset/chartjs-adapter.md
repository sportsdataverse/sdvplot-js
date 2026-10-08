---
"@sportsdataverse/sdvplot": minor
---

`sdvplot/chartjs`: Chart.js 4 team logo, wordmark and headshot point styles, axis-tick logos, faint logo watermarks and team colours; `chart.js` is an optional peer (>= 4.4). A `loadImage` option on every image helper (`logoPoints`, `wordmarkPoints`, `headshotPoints`, `axisLogos`, `logoWatermarks`) loads the marks through your own loader instead of a DOM image, so charts render in Node on `@napi-rs/canvas` (pass its `loadImage`); images that arrive after a draw redraw the chart. Type `ImageLike`.

`sdvplot/chartjs/surface` `surface(league, o)`: a team-painted sporty court, field or rink as a Chart.js background plugin, with the linear scales that span it, for shot charts and hexbins (it imports the optional peer `@sportsdataverse/sporty`, so install sporty to use it; `sdvplot/chartjs` itself does not need sporty).
