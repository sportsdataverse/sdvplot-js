import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamChartConfig } from "@sportsdataverse/sdvplot/shadcn";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";
// shadcn's chart.tsx, as `npx shadcn add chart` copies it into an app
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "../../vendor/shadcn/chart.js";

export const meta = {
  title: "shadcn/ui: the AFC West's 2024 wins week by week, in team colours with a logo legend",
  tags: ["react", "shadcn", "recharts", "teamChartConfig", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const west = TEAMS.map((team) => {
  const t = AFC_WEEKS_2024.find((w) => w.team === team);
  if (t === undefined) throw new Error(`${team} is not in AFC_WEEKS_2024`);
  return t;
});
// a CSS-safe key per team: each line's dataKey and its colour, var(--color-<key>); the legend draws each logo
const { config, keys } = teamChartConfig("nfl", TEAMS);
// one row per week, one column per team (its key): wins so far, so a bye week keeps the total
const rows = Array.from({ length: 18 }, (_, w) => ({
  week: w + 1,
  ...Object.fromEntries(
    west.map((t, i) => [keys[i], t.margins.slice(0, w + 1).filter((m) => m !== null && m > 0).length]),
  ),
}));

export default (
  <ChartContainer
    id="afc-west-wins"
    config={config}
    initialDimension={{ width: 560, height: 360 }}
    style={{ width: 560, height: 360, background: "#ffffff" }}
  >
    <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="week" type="number" domain={[1, 18]} ticks={[1, 6, 12, 18]} tickLine={false} />
      <YAxis domain={[0, 16]} tickLine={false} width={32} />
      <ChartTooltip
        content={<ChartTooltipContent labelFormatter={(_, payload) => `Week ${payload[0]?.payload.week}`} />}
      />
      <ChartLegend content={<ChartLegendContent />} />
      {keys.map((key) => (
        <Line
          key={key}
          dataKey={key}
          stroke={`var(--color-${key})`}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  </ChartContainer>
);
