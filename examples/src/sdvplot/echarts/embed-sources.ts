import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, logoUrlSync } from "@sportsdataverse/sdvplot";
import { embedSources, withLogos } from "@sportsdataverse/sdvplot/echarts";
import * as echarts from "echarts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "ECharts: logos inlined as data URIs, so the saved SVG shows them offline (embedSources)",
  tags: ["node", "network", "echarts", "embedSources", "withLogos", "ssr", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The AFC West's two playoff teams of 2024.
const rows = STANDINGS.filter((s) => s.division === "West" && s.wins >= 11).map((s) => ({ ...s }));

// embedSources fetches each distinct URL once and maps it to a data URI; `embed` swaps each link for its bytes,
// so the SVG below is one self-contained file (a static export, an email, an offline page).
const embed = await embedSources(rows.flatMap((r) => logoUrlSync(r.team, "nfl") ?? []));

const option: echarts.EChartsOption = {
  xAxis: { type: "value", name: "Points for", nameLocation: "middle", nameGap: 28, min: 370, max: 420 },
  yAxis: { type: "value", name: "Points against", nameLocation: "middle", nameGap: 40, min: 290, max: 340 },
  series: [{ type: "scatter", data: rows.map((r) => [r.pf, r.pa]), symbolSize: 0 }],
};
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 420, height: 320 });
chart.setOption(
  withLogos(option, rows, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.25, embed }),
);
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
