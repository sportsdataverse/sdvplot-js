import { BarPlot, FocusedBar } from "@mui/x-charts/BarChart";
import { ChartsContainer } from "@mui/x-charts/ChartsContainer";
import { ChartsGrid } from "@mui/x-charts/ChartsGrid";
import { ChartsTooltip } from "@mui/x-charts/ChartsTooltip";
import { ChartsXAxis } from "@mui/x-charts/ChartsXAxis";
import { ChartsYAxis } from "@mui/x-charts/ChartsYAxis";
import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoTickLabel, teamColorGetter } from "@sportsdataverse/sdvplot/mui";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "MUI X Charts: 2024 wins of eight AFC teams, each bar in its team's colour, logos on the axis",
  tags: ["react", "mui-x-charts", "bar", "logoTickLabel", "teamColorGetter", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// each team picked by id from the week-by-week score margins (null is the bye week); a win is a positive margin
const teams = ["KC", "BUF", "LAC", "DEN", "MIA", "LV", "NYJ", "NE"];
const wins = teams.map((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  return season.margins.filter((m) => m !== null && m > 0).length;
});
// bar i takes teams[i]'s colour; the logos go on the team axis alone, as a prop of its <ChartsXAxis>
const tick = logoTickLabel({ league: "nfl", size: 30 });

export default (
  <ChartsContainer
    width={640}
    height={360}
    skipAnimation
    xAxis={[{ id: "teams", scaleType: "band", data: teams, height: 44 }]}
    yAxis={[{ id: "wins", label: "wins", min: 0, max: 17 }]}
    series={[{ type: "bar", label: "wins", data: wins, colorGetter: teamColorGetter("nfl", teams) }]}
  >
    <ChartsGrid horizontal />
    <BarPlot />
    {/* the composition API leaves out the keyboard focus mark the one-component BarChart draws: add it back */}
    <FocusedBar />
    <ChartsXAxis axisId="teams" slots={{ axisTickLabel: tick }} />
    <ChartsYAxis axisId="wins" />
    <ChartsTooltip />
  </ChartsContainer>
);
