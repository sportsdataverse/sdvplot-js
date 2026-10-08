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
  color: teamColorPalette("nfl", names), // with colorBy "data", one colour per bar
  xAxis: { type: "category", data: names },
  yAxis: { type: "value", name: "Wins (2024)" },
  series: [{ type: "bar", colorBy: "data", data: teams.map((t) => t.wins) }],
};

const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 560, height: 360 });
chart.setOption(withAxisLogos(option, "x", { league: "nfl", height: 0.1, chartHeight: 360 }));
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
