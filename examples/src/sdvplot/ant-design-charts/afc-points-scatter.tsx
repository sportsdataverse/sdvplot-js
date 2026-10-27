import { Scatter } from "@ant-design/plots";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoMark, teamColorScale } from "@sportsdataverse/sdvplot/g2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Ant Design Charts: 2024 AFC points for and against, each team a logo over its team-coloured point",
  tags: ["react", "ant-design-charts", "g2", "logoMark", "teamColorScale", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// the AFC West and East, picked by id
const TEAMS = ["KC", "LAC", "DEN", "LV", "BUF", "MIA", "NYJ", "NE"];
const rows = TEAMS.map((team) => {
  const s = STANDINGS.find((r) => r.team === team);
  if (s === undefined) throw new Error(`${team} is not in STANDINGS`);
  return { team, pf: s.pf, pa: s.pa, record: `${s.wins}-${s.losses}` };
});
// The config is a G2 spec underneath: a G2 scale.color, and an image mark in `annotations`, which Ant Design Charts
// hands to G2 as it is (a mark in `children` would take the plot's xField, yField and colorField too)
const config = {
  data: rows,
  xField: "pf",
  yField: "pa",
  colorField: "team",
  scale: { color: teamColorScale("nfl", TEAMS), y: { range: [0, 1] } }, // fewer points allowed is better: up
  legend: false,
  axis: { x: { title: "Points for" }, y: { title: "Points against (fewer is up)" } },
  tooltip: { title: "team", items: [{ field: "record", name: "W-L" }] },
  annotations: [logoMark(rows, { x: "pf", y: "pa", team: "team", league: "nfl", size: 30 })],
  height: 400,
};

// In the browser: <Scatter {...config} />, here at 560 px wide
export const browser = {
  lib: "ant-design-charts",
  chart: () => <Scatter {...config} />,
  width: 560,
  height: 400,
  label:
    "2024 points for against points against for the AFC West and East, each team drawn as its logo over a point in its colour: Buffalo scored most (525), the Chargers allowed fewest (301)",
} as const;

// Ant Design Charts draws only in a browser; without JavaScript the page shows each team's points and colour
export default rows.map((r, i) => ({ ...r, color: config.scale.color.range[i] }));
