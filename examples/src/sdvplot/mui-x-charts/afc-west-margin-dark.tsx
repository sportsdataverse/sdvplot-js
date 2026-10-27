import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";
import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoMark, teamColors } from "@sportsdataverse/sdvplot/mui";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "MUI X Charts: the 2024 AFC West's running point differential in a dark theme, team colours and end logos",
  tags: ["react", "mui-x-charts", "line", "logoMark", "teamColors", "dark mode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// each team picked by id from the week-by-week score margins (null is the bye week); the line is their running sum
const teams = ["KC", "LAC", "DEN", "LV"];
const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
const series = teams.map((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  const data: number[] = [];
  for (const m of season.margins) data.push((data.at(-1) ?? 0) + (m ?? 0));
  // the series id is the team: logoMark draws its logo at the one mark showMark keeps, week 18
  return { id: team, label: team, data, showMark: ({ index }: { index: number }) => index === 17 };
});
const dark = createTheme({ palette: { mode: "dark" } });

export default (
  <ThemeProvider theme={dark}>
    {/* MUI's dark background; teamColors gives each line its colour for the theme's mode */}
    <div style={{ background: dark.palette.background.default, width: 640 }}>
      <LineChart
        width={640}
        height={380}
        skipAnimation
        margin={{ top: 16, right: 32 }}
        colors={teamColors("nfl", teams)}
        xAxis={[{ data: weeks, label: "week", tickInterval: [1, 6, 12, 18] }]}
        yAxis={[{ label: "point differential", width: 56 }]}
        series={series}
        slots={{ mark: logoMark({ league: "nfl", size: 28 }) }}
      />
    </div>
  </ThemeProvider>
);
