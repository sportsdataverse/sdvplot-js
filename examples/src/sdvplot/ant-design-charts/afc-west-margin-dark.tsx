import { Line } from "@ant-design/plots";
import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoMark, teamColorScale } from "@sportsdataverse/sdvplot/g2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Ant Design Charts, dark: the AFC West's running 2024 point differential, dark-mode team colours, a logo at each line's end",
  tags: ["react", "ant-design-charts", "g2", "logoMark", "teamColorScale", "dark", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const BACKGROUND = "#141414"; // the page behind G2's dark theme (its own background is transparent)
// one row per team and week: the margin summed to date (the bye adds nothing)
const rows = TEAMS.flatMap((team) => {
  const t = AFC_WEEKS_2024.find((w) => w.team === team);
  if (t === undefined) throw new Error(`${team} is not in AFC_WEEKS_2024`);
  return t.margins.map((_, i) => ({
    team,
    week: i + 1,
    margin: t.margins.slice(0, i + 1).reduce<number>((sum, m) => sum + (m ?? 0), 0),
  }));
});
// the colours read on the dark background (3:1): Denver's navy and the Raiders' black are lifted
const color = teamColorScale("nfl", TEAMS, { background: BACKGROUND });
const ends = rows.filter((r) => r.week === 18);

const config = {
  data: rows,
  xField: "week",
  yField: "margin",
  colorField: "team",
  scale: { color, x: { domain: [1, 18.6] } }, // room right of week 18 for the end logos
  theme: "dark",
  style: { lineWidth: 2.5 },
  axis: { x: { title: "Week", tickCount: 6 }, y: { title: "Point differential, season to date" } },
  legend: { color: { position: "top" } },
  // the logos ride on the lines' last points; in `annotations`, the plot's fields do not reach them
  annotations: [logoMark(ends, { x: "week", y: "margin", team: "team", league: "nfl", size: 24 })],
  height: 360,
  containerStyle: { background: BACKGROUND, height: 360 },
};

// In the browser: <Line {...config} />, here at 560 px wide on the dark background
export const browser = {
  lib: "ant-design-charts",
  chart: () => <Line {...config} />,
  width: 560,
  height: 360,
  label:
    "The 2024 AFC West's point differential summed week by week on a dark background, each line in its team's dark-mode colour and ending in its logo: Denver +114, the Chargers +101, Kansas City +59, Las Vegas -125",
} as const;

// Ant Design Charts draws only in a browser; without JavaScript the page shows each team's final margin and colour
export default ends.map((r) => ({
  team: r.team,
  margin: r.margin,
  color: color.range[color.domain.indexOf(r.team)],
}));
