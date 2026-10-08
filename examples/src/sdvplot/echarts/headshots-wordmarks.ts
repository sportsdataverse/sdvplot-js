import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withHeadshots, withWordmarks } from "@sportsdataverse/sdvplot/echarts";
import * as echarts from "echarts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "ECharts: wins by team, the quarterback on top, the wordmark inside (server-side SVG)",
  tags: ["node", "echarts", "withHeadshots", "withWordmarks", "ssr", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Each image sits at a row's (x, y): the headshot just above the bar, the wordmark halfway up it.
const rows = [...STANDINGS]
  .sort((a, b) => b.wins - a.wins)
  .map((s) => ({ ...s, qb_y: s.wins + 1.7, mark_y: s.wins / 2 }));
const option: echarts.EChartsOption = {
  xAxis: { type: "category", data: rows.map((r) => r.team), axisLabel: { show: false } },
  yAxis: { type: "value", name: "Wins (2024)", max: 18 },
  series: [{ type: "bar", data: rows.map((r) => r.wins), itemStyle: { color: "#e8e8e8" } }],
};
const headshots = withHeadshots(option, rows, {
  league: "nfl",
  x: "team",
  y: "qb_y",
  player: "qb_espn_id",
  height: 0.14,
});
const both = withWordmarks(headshots, rows, {
  league: "nfl",
  x: "team",
  y: "mark_y",
  team: "team",
  height: 0.05,
});

const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 560, height: 360 });
chart.setOption(both);
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
