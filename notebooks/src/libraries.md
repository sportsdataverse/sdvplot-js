---
title: Chart libraries
---

# Chart libraries

sdvplot is not only for Observable Plot. Its adapters add team logos to a chart you build in Plotly, Vega-Lite, ECharts or Chart.js: as the points of a scatter, or as the labels of a category axis. Each adapter edits that library's own figure, spec, option or config (the library still draws it, with its own hover, zoom and tooltips), so the code below is ordinary code for each library plus one sdvplot call. All four draw the same real data: every NFL team's 2024 EPA per play (nflverse), and the wins of the 2024 AFC West and East.

```js
import { loadLeague } from "./_sdv/sdvplot.js";
import * as plotly from "./_sdv/plotly.js";
import * as vega from "./_sdv/vega.js";
import * as echarts from "./_sdv/echarts.js";
import * as chartjs from "./_sdv/chartjs.js";
// the libraries themselves, bundled at build time from the versions the docs use
import Plotly from "./_sdv/lib/plotly.js";
import vegaEmbed from "./_sdv/lib/vega.js";
import { init as echartsInit } from "./_sdv/lib/echarts.js";
import { Chart, registerables } from "./_sdv/lib/chartjs.js";
import { range, select } from "./components/controls.js";
Chart.register(...registerables);
```

```js
const epa = (await FileAttachment("data/nfl_epa_2024.json").json()).map((t) => ({
  team: t.team,
  offense: +(t.off_epa / t.off_plays).toFixed(4),
  defense: +(t.def_epa / t.def_plays).toFixed(4),
}));
const afc = [...(await FileAttachment("data/standings.json").json())].sort((a, b) => b.wins - a.wins);
await loadLeague("nfl");
```

**Chart** picks the scatter (32 logos at each team's offensive and defensive EPA per play; the defence axis is reversed, so up is better) or the bars (the AFC's wins, in team colours, with a logo under each bar). **Logo size** is a fraction of the plot's height for Plotly, Vega-Lite and ECharts; Chart.js sizes images in pixels, so its logos are that fraction of the canvas height. Every chart follows this page's light or dark mode. Hover a logo or a bar in any of them for its numbers.

```js
const chart = view(select(["Offence vs defence (scatter)", "AFC wins (bars)"], { label: "Chart", value: "Offence vs defence (scatter)" }));
const logoSize = view(range([0.05, 0.14], { label: "Logo size", step: 0.01, value: 0.08 }));
```

```js
const scatter = chart.startsWith("Offence");
const w = Math.min(width, 720);
const h = Math.round(Math.min(480, Math.max(300, w * 0.62)));
const ink = dark ? "#e6e6e6" : "#222222";
const gridInk = dark ? "#3a3a3a" : "#e5e5e5";
const teams = afc.map((s) => s.team);
const fmt = (v) => `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
```

## Plotly

`withLogos(figure, rows, options)` adds one `layout.images` entry per row, which plotly.js loads itself; the scatter's own markers are invisible but keep Plotly's hover. `withAxisLogos(figure, "x", options)` hides the axis's category labels (they are hidden, not blanked, so hovering a bar still names its team) and draws a logo under each; `teamColorway` gives one colour per bar.

```js
const plotlyDiv = document.createElement("div");
const layout = {
  width: w,
  height: h,
  margin: { t: 30, r: 20, b: scatter ? 50 : 70, l: 76 },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: ink },
  xaxis: { gridcolor: gridInk, zerolinecolor: ink, title: { text: scatter ? "Offensive EPA/play" : "" } },
  yaxis: {
    gridcolor: gridInk,
    zerolinecolor: ink,
    title: { text: scatter ? "Defensive EPA/play allowed" : "Wins" },
    autorange: scatter ? "reversed" : true,
  },
};
const figure = scatter
  ? plotly.withLogos(
      {
        data: [
          {
            type: "scatter",
            mode: "markers",
            x: epa.map((t) => t.offense),
            y: epa.map((t) => t.defense),
            text: epa.map((t) => t.team),
            marker: { size: 24, opacity: 0 },
            hovertemplate: "%{text}<br>Offence %{x:+.3f}<br>Defence %{y:+.3f}<extra></extra>",
          },
        ],
        layout,
      },
      epa,
      { league: "nfl", x: "offense", y: "defense", team: "team", height: logoSize },
    )
  : plotly.withAxisLogos(
      {
        data: [
          {
            type: "bar",
            x: teams,
            y: afc.map((s) => s.wins),
            marker: { color: plotly.teamColorway("nfl", teams) },
            hovertemplate: "%{x}: %{y} wins<extra></extra>",
          },
        ],
        layout,
      },
      "x",
      { league: "nfl", height: logoSize },
    );
await Plotly.newPlot(plotlyDiv, figure.data, figure.layout, { displaylogo: false });
invalidation.then(() => Plotly.purge(plotlyDiv));
display(plotlyDiv);
```

## Vega-Lite

`withLogos(spec, rows, options)` layers an image mark over the spec, one logo per row; `withAxisLogos(spec, "x", options)` blanks the axis labels and layers a logo under each tick. `teamColorScale` is a Vega-Lite colour scale of team colours. The image layers never take the tooltip, so the chart's own `tooltip` encoding is what shows. vega-embed draws it on the SVG renderer.

```js
const vegaDiv = document.createElement("div");
const base = {
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  width: w - 90,
  height: h - 70,
  background: "transparent",
  config: { axis: { labelColor: ink, titleColor: ink, gridColor: gridInk, domainColor: ink, tickColor: ink }, view: { stroke: null } },
};
const spec = scatter
  ? vega.withLogos(
      {
        ...base,
        data: { values: epa },
        mark: { type: "point", opacity: 0, size: 500, filled: true },
        encoding: {
          x: { field: "offense", type: "quantitative", title: "Offensive EPA/play", axis: { format: "+.2f" } },
          y: { field: "defense", type: "quantitative", title: "Defensive EPA/play allowed", scale: { reverse: true }, axis: { format: "+.2f" } },
          tooltip: [
            { field: "team", title: "Team" },
            { field: "offense", title: "Offence", format: "+.3f" },
            { field: "defense", title: "Defence", format: "+.3f" },
          ],
        },
      },
      epa,
      { league: "nfl", x: "offense", y: "defense", team: "team", height: logoSize },
    )
  : vega.withAxisLogos(
      {
        ...base,
        data: { values: afc },
        mark: "bar",
        encoding: {
          x: { field: "team", type: "nominal", sort: teams, title: null },
          y: { field: "wins", type: "quantitative", title: "Wins" },
          color: { field: "team", type: "nominal", scale: vega.teamColorScale("nfl", teams), legend: null },
          tooltip: [
            { field: "team", title: "Team" },
            { field: "wins", title: "Wins" },
          ],
        },
      },
      "x",
      { league: "nfl", height: logoSize },
    );
const vegaView = await vegaEmbed(vegaDiv, spec, { mode: "vega-lite", renderer: "svg", actions: false });
invalidation.then(() => vegaView.finalize());
display(vegaDiv);
```

## ECharts

`withLogos(option, rows, options)` adds a custom series that draws one image per row at its data coordinates; `withAxisLogos(option, "x", options)` replaces the category labels with rich-text images; `teamColorPalette` is the palette for `colorBy: "data"`. The logo series is silent and keeps out of the tooltip, so the chart's own series answers it.

```js
const echartsDiv = document.createElement("div");
const axisStyle = { axisLabel: { color: ink }, nameTextStyle: { color: ink }, axisLine: { lineStyle: { color: ink } }, splitLine: { lineStyle: { color: gridInk } } };
const option = scatter
  ? echarts.withLogos(
      {
        backgroundColor: "transparent",
        grid: { left: 60, right: 20, top: 20, bottom: 50 },
        tooltip: { formatter: (p) => `${p.data[2]}<br>Offence ${fmt(p.data[0])}<br>Defence ${fmt(p.data[1])}` },
        xAxis: { type: "value", name: "Offensive EPA/play", nameLocation: "middle", nameGap: 28, ...axisStyle },
        yAxis: { type: "value", name: "Defensive EPA/play allowed", nameLocation: "middle", nameGap: 44, inverse: true, ...axisStyle },
        series: [{ type: "scatter", data: epa.map((t) => [t.offense, t.defense, t.team]), symbolSize: 26, itemStyle: { opacity: 0 } }],
      },
      epa,
      { league: "nfl", x: "offense", y: "defense", team: "team", height: logoSize },
    )
  : echarts.withAxisLogos(
      {
        backgroundColor: "transparent",
        grid: { left: 50, right: 20, top: 20, bottom: 60 },
        tooltip: {},
        color: echarts.teamColorPalette("nfl", teams),
        xAxis: { type: "category", data: teams, ...axisStyle },
        yAxis: { type: "value", name: "Wins", ...axisStyle },
        series: [{ type: "bar", colorBy: "data", data: afc.map((s) => s.wins), name: "Wins" }],
      },
      "x",
      { league: "nfl", height: logoSize, chartHeight: h },
    );
const echart = echartsInit(echartsDiv, null, { renderer: "svg", width: w, height: h });
echart.setOption(option);
invalidation.then(() => echart.dispose());
display(echartsDiv);
```

## Chart.js

Chart.js draws on a canvas, so sdvplot's helpers are plugins: `logoPoints(teams, options)` turns each point into its team's logo (with `pointImages`, which redraws as each image lands), and `axisLogos("x", options)` paints a logo in place of each category label. `teamColor` gives one colour per bar. The tooltips are Chart.js's own.

```js
const canvas = document.createElement("canvas");
canvas.width = w;
canvas.height = h;
canvas.style.maxWidth = "100%";
canvas.style.height = "auto";
const px = Math.round(logoSize * h); // the logo height in pixels
const scaleStyle = { ticks: { color: ink }, grid: { color: gridInk }, title: { color: ink } };
const config = scatter
  ? {
      type: "scatter",
      data: {
        datasets: [
          {
            data: epa.map((t) => ({ x: t.offense, y: t.defense })),
            ...chartjs.logoPoints(
              epa.map((t) => t.team),
              { league: "nfl", radius: Math.round(px / 2) },
            ),
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${epa[c.dataIndex].team}: offence ${fmt(c.parsed.x)}, defence ${fmt(c.parsed.y)}` } },
        },
        scales: {
          x: { ...scaleStyle, title: { ...scaleStyle.title, display: true, text: "Offensive EPA/play" } },
          y: { ...scaleStyle, reverse: true, title: { ...scaleStyle.title, display: true, text: "Defensive EPA/play allowed" } },
        },
      },
      plugins: [chartjs.pointImages],
    }
  : {
      type: "bar",
      data: { labels: teams, datasets: [{ data: afc.map((s) => s.wins), backgroundColor: chartjs.teamColor(teams, "nfl") }] },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.y} wins` } } },
        scales: { x: scaleStyle, y: { ...scaleStyle, title: { ...scaleStyle.title, display: true, text: "Wins" } } },
      },
      plugins: [chartjs.axisLogos("x", { league: "nfl", size: px })],
    };
const cjs = new Chart(canvas, config);
invalidation.then(() => cjs.destroy());
canvas.setAttribute("role", "img");
canvas.setAttribute(
  "aria-label",
  scatter ? "Every NFL team's 2024 EPA per play, offence against defence, as team logos" : "2024 AFC wins by team, with each team's logo under its bar",
);
display(canvas);
```
