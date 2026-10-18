import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoDot, teamColorPalette } from "@sportsdataverse/sdvplot/recharts";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Recharts: the AFC West's 2024 win totals week by week, a logo at the end of each line",
  tags: ["react", "recharts", "logoDot", "teamColorPalette", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Wins so far after each week's game (a positive margin is a win), from the 2024 results; the bye week has no point.
const west = AFC_WEEKS_2024.slice(0, 4);
const colors = teamColorPalette(
  "nfl",
  west.map((t) => t.team),
);
const series = west.map(({ team, margins }, i) => {
  let wins = 0;
  return {
    team,
    color: colors[i] ?? "#808080",
    rows: margins.flatMap((m, week) => {
      if (m === null) return [];
      wins += m > 0 ? 1 : 0;
      return [{ week: week + 1, wins, team }];
    }),
  };
});

export default (
  <LineChart width={560} height={340} margin={{ top: 20, right: 40, bottom: 20, left: 0 }}>
    <CartesianGrid stroke="#e2e2e2" />
    <XAxis dataKey="week" type="number" domain={[1, 18]} ticks={[1, 6, 12, 18]} />
    <YAxis domain={[0, 16]} />
    {series.map((s) => (
      <Line
        key={s.team}
        data={s.rows}
        dataKey="wins"
        stroke={s.color}
        strokeWidth={2}
        isAnimationActive={false}
        // `last` draws only each line's final point: the team's logo at its season's win total
        dot={logoDot({ team: "team", league: "nfl", size: 28, last: true })}
      />
    ))}
  </LineChart>
);
