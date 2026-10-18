import { KC_PHI_GAMES_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorPalette, withLogos } from "@sportsdataverse/sdvplot/echarts";
import * as echarts from "echarts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "ECharts: Kansas City's and Philadelphia's 2024 running point differential, each line ending at its logo (server-side SVG)",
  tags: ["node", "echarts", "withLogos", "teamColorPalette", "ssr", "line", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const teams = ["KC", "PHI"] as const;
// Each team's running point differential after every game it played, by week (bye weeks have no point).
const running = teams.map((team) => {
  let total = 0;
  return KC_PHI_GAMES_2024.filter((g) => g.home_team === team || g.away_team === team)
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      total += (g.home_team === team ? 1 : -1) * (g.home_score - g.away_score);
      return [g.week, total] as [number, number];
    });
});
const option: echarts.EChartsOption = {
  tooltip: { trigger: "axis" },
  color: teamColorPalette("nfl", [...teams]), // one colour per series, in order
  xAxis: { type: "value", name: "Week", min: 1, max: 19.5, interval: 2 },
  yAxis: { type: "value", name: "Point differential" },
  series: teams.map((team, i) => ({
    type: "line" as const,
    name: team,
    data: running[i] ?? [],
    symbolSize: 5,
  })),
};
// One row per logo: each team just past its last game, at its final differential.
const ends = teams.map((team, i) => {
  const [, total] = running[i]?.at(-1) ?? [0, 0];
  return { team, week: 19, total };
});
const both = withLogos(option, ends, { league: "nfl", x: "week", y: "total", team: "team", height: 0.12 });

// In the browser: echarts.init(div, null, { width, height }) and setOption(option), as this page does.
export const browser = {
  lib: "echarts",
  option: both,
  width: 600,
  height: 360,
  label:
    "Kansas City's and Philadelphia's running point differential over the 2024 regular season, by week, each line in its team's colour and ending at its logo",
} as const;

// SSR: no DOM, no canvas. The logos are <image href> links the browser loads when it shows the SVG.
const { width, height } = browser;
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
chart.setOption(both);
const svg = chart.renderToSVGString();
chart.dispose();
export default svg;
