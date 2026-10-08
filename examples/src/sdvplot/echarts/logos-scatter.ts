import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withLogos } from "@sportsdataverse/sdvplot/echarts";
import * as echarts from "echarts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "ECharts: points for and against, with team logos (server-side SVG)",
  tags: ["node", "echarts", "withLogos", "ssr", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = STANDINGS.map((s) => ({ ...s }));
const option: echarts.EChartsOption = {
  xAxis: { type: "value", name: "Points for", nameLocation: "middle", nameGap: 28, min: 260, max: 550 },
  yAxis: { type: "value", name: "Points against", nameLocation: "middle", nameGap: 40, min: 270, max: 450 },
  series: [{ type: "scatter", data: rows.map((r) => [r.pf, r.pa]), symbolSize: 0 }],
};

// In the browser: echarts.init(div, null, { width, height }) and setOption(option), as this page does.
export const browser = {
  lib: "echarts",
  option: withLogos(option, rows, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.12 }),
  width: 560,
  height: 380,
  label: "2024 AFC points for against points against, each team drawn as its logo",
} as const;

// SSR: no DOM, no canvas. The logos are <image href> links the browser loads when it shows the SVG.
const { width, height } = browser;
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
chart.setOption(browser.option);
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
