import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { LogoTick } from "@sportsdataverse/sdvplot/react";
import { teamColorPalette } from "@sportsdataverse/sdvplot/victory";
import { VictoryAxis, VictoryBar, VictoryChart } from "victory";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Victory: the AFC East's and West's 2024 point differentials, logo ticks on a dark background",
  tags: ["react", "victory", "bar", "LogoTick", "teamColorPalette", "dark mode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Each team picked by id from the week-by-week margins (null is the bye); its season's point differential is their sum.
const teams = ["BUF", "KC", "LAC", "DEN", "MIA", "NYJ", "NE", "LV"];
const background = "#181a1b";
// every bar's colour keeps 3:1 against the background and stays apart from the others (DEN and NE share a navy)
const colors = teamColorPalette("nfl", teams, { background });
const rows = teams.map((team, i) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  return { team, diff: season.margins.reduce((n: number, m) => n + (m ?? 0), 0), color: colors[i] };
});
const ink = { fill: "#e3e3e3", fontSize: 12 };

export default (
  <VictoryChart
    width={640}
    height={340}
    domainPadding={{ x: 30, y: 12 }}
    padding={{ top: 24, right: 24, bottom: 56, left: 56 }}
    style={{ parent: { background } }}
  >
    {/* the team axis sits at the bottom whatever the sign of the bars; each label is the team's logo, 32 px */}
    <VictoryAxis
      offsetY={56}
      tickLabelComponent={<LogoTick league="nfl" size={32} />}
      style={{ axis: { stroke: "#5f6368" } }}
    />
    <VictoryAxis
      dependentAxis
      label="point differential"
      style={{
        axis: { stroke: "#5f6368" },
        grid: { stroke: "#3a3d3f" },
        tickLabels: ink,
        axisLabel: { ...ink, padding: 40 },
      }}
    />
    <VictoryBar
      data={rows}
      x="team"
      y="diff"
      barWidth={36}
      style={{ data: { fill: ({ datum }) => datum.color } }}
    />
  </VictoryChart>
);
