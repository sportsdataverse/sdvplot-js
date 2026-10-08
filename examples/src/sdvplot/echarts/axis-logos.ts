import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorPalette, withAxisLogos } from "@sportsdataverse/sdvplot/echarts";
import * as echarts from "echarts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "ECharts: wins by team, logos on the axis, team-coloured bars (server-side SVG)",
  tags: ["node", "echarts", "withAxisLogos", "teamColorPalette", "ssr", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const teams = [...STANDINGS].sort((a, b) => b.wins - a.wins);
const names = teams.map((t) => t.team);
const option: echarts.EChartsOption = {
  tooltip: {}, // in the browser, hovering a bar shows its team and wins
  color: teamColorPalette("nfl", names), // with colorBy "data", one colour per bar
  xAxis: { type: "category", data: names },
  yAxis: { type: "value", name: "Wins (2024)" },
  series: [{ type: "bar", colorBy: "data", data: teams.map((t) => t.wins) }],
};

// In the browser: echarts.init(div, null, { width, height }) and setOption(option), as this page does.
export const browser = {
  lib: "echarts",
  option: withAxisLogos(option, "x", { league: "nfl", height: 0.1, chartHeight: 360 }),
  width: 560,
  height: 360,
  label: "2024 AFC wins by team, best first, each bar in its team's colour with the team's logo under it",
} as const;

// SSR: no DOM, no canvas. The logos are <image href> links the browser loads when it shows the SVG.
const { width, height } = browser;
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
chart.setOption(browser.option);
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
