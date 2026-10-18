import { NHL_STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorPalette, withAxisLogos } from "@sportsdataverse/sdvplot/echarts";
import * as echarts from "echarts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "ECharts: the Atlantic Division's points as horizontal bars, logos down the y axis (server-side SVG)",
  tags: ["node", "echarts", "withAxisLogos", "teamColorPalette", "ssr", "hockey", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");
const teams = NHL_STANDINGS.map((s) => s.team); // division order, first to eighth
const option: echarts.EChartsOption = {
  tooltip: {}, // in the browser, hovering a bar shows its team and points
  color: teamColorPalette("nhl", teams), // with colorBy "data", one colour per bar
  grid: { left: 70 }, // room for the logos left of the plot
  // inverse: the first category on top, as a standings table reads
  yAxis: { type: "category", data: teams, inverse: true },
  xAxis: { type: "value", name: "Points (2025-26)", nameLocation: "middle", nameGap: 28 },
  series: [{ type: "bar", colorBy: "data", data: NHL_STANDINGS.map((s) => s.points) }],
};

// In the browser: echarts.init(div, null, { width, height }) and setOption(option), as this page does.
export const browser = {
  lib: "echarts",
  // on the y axis each label becomes a rich-text image; `chartHeight` sizes it against the plot area
  option: withAxisLogos(option, "y", { league: "nhl", height: 0.09, chartHeight: 400 }),
  width: 540,
  height: 400,
  label:
    "The 2025-26 Atlantic Division's points, first place on top: Buffalo, Tampa Bay, Montreal, Boston, Ottawa, Detroit, Florida and Toronto, each bar in its team's colour with its logo beside it",
} as const;

// SSR: no DOM, no canvas. The logos are <image href> links the browser loads when it shows the SVG.
const { width, height } = browser;
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
chart.setOption(browser.option);
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
