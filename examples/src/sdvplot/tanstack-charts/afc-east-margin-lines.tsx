import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoDots, teamColorScale, withPatterns } from "@sportsdataverse/sdvplot/tanstack";
import { colorLegend, defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { renderChartSvg } from "@tanstack/charts/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "TanStack Charts: the 2024 AFC East's running point differential in team colours, a logo at each line's end",
  tags: ["react", "tanstack-charts", "line", "teamColorScale", "logoDots", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// each team picked by id from the week-by-week score margins (null is the bye week); the line is their running sum
const TEAMS = ["BUF", "MIA", "NYJ", "NE"];
const rows = TEAMS.flatMap((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  let total = 0;
  return season.margins.map((m, i) => {
    total += m ?? 0;
    return { team, week: i + 1, diff: total };
  });
});
// each line in its team's colour, keyed by the team value the `z` channel reads
const color = teamColorScale("nfl", TEAMS);
// one logo per team, at its week-18 point
const ends = logoDots(
  rows.filter((r) => r.week === 18),
  { x: "week", y: "diff", team: "team", league: "nfl", size: 28 },
);

export default (
  <Chart
    definition={defineChart({
      marks: [lineY(rows, { x: "week", y: "diff", z: "team" }), ...ends.map((d) => dot(d.data, d.options))],
      scales: {
        x: { scale: scaleLinear, axis: { label: "week" } },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: "point differential" } },
      },
      color: { ...color, legend: colorLegend({ label: "team" }) },
    })}
    renderSvg={withPatterns(renderChartSvg, ends)}
    idPrefix="afc-east"
    width={640}
    height={400}
    ariaLabel={`The 2024 AFC East's running point differential by week: ${TEAMS.map((t) => `${t} ${rows.find((r) => r.team === t && r.week === 18)?.diff}`).join(", ")} after week 18`}
    style={{ background: "#ffffff", color: "#1c1e21" }}
  />
);
