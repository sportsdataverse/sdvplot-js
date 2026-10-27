import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoDots, teamColorScale, withPatterns } from "@sportsdataverse/sdvplot/tanstack";
import { defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { renderChartSvg } from "@tanstack/charts/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "TanStack Charts: the 2024 AFC West's running point differential on a dark card, team colours that read on it and end logos",
  tags: ["react", "tanstack-charts", "line", "teamColorScale", "logoDots", "dark mode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const rows = TEAMS.flatMap((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  let total = 0;
  return season.margins.map((m, i) => {
    total += m ?? 0;
    return { team, week: i + 1, diff: total };
  });
});
// the card's background: every team colour keeps 3:1 contrast on it (the Raiders' black and the Broncos' navy
// would not), and the four stay distinct
const BG = "#111827";
const color = teamColorScale("nfl", TEAMS, { background: BG });
// the dark variants of the logos, one per team at its week-18 point
const ends = logoDots(
  rows.filter((r) => r.week === 18),
  { x: "week", y: "diff", team: "team", league: "nfl", size: 28, variant: "dark" },
);

export default (
  // TanStack Charts draws its axes and text in currentColor: the card's `color` is the foreground
  <Chart
    definition={defineChart({
      marks: [
        lineY(rows, { id: "margin", x: "week", y: "diff", z: "team", strokeWidth: 2.5 }),
        ...ends.map((d) => dot(d.data, d.options)),
      ],
      scales: {
        x: { scale: scaleLinear, axis: { label: "week" } },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: "point differential" } },
      },
      color,
    })}
    renderSvg={withPatterns(renderChartSvg, ends)}
    idPrefix="afc-west-dark"
    width={640}
    height={400}
    ariaLabel={`The 2024 AFC West's running point differential by week, on a dark background: ${TEAMS.map((t) => `${t} ${rows.find((r) => r.team === t && r.week === 18)?.diff}`).join(", ")} after week 18`}
    style={{ background: BG, color: "#e6edf7" }}
  />
);
