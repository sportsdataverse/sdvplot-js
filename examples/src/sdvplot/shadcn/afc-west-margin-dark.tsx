import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamChartConfig } from "@sportsdataverse/sdvplot/shadcn";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "../../vendor/shadcn/chart.js";

export const meta = {
  title: "shadcn/ui, dark: the AFC West's running 2024 point differential, the dark theme's team colours",
  tags: ["react", "shadcn", "recharts", "teamChartConfig", "dark", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const west = TEAMS.map((team) => {
  const t = AFC_WEEKS_2024.find((w) => w.team === team);
  if (t === undefined) throw new Error(`${team} is not in AFC_WEEKS_2024`);
  return t;
});
// each team's `theme.dark` colour reads on shadcn's dark card (3:1): Denver's navy and the Raiders' black are lifted
const { config, keys } = teamChartConfig("nfl", TEAMS);
const rows = Array.from({ length: 18 }, (_, w) => ({
  week: w + 1,
  ...Object.fromEntries(
    west.map((t, i) => [keys[i], t.margins.slice(0, w + 1).reduce<number>((sum, m) => sum + (m ?? 0), 0)]),
  ),
}));

// shadcn's dark mode is a `dark` class above the chart: its <ChartStyle> sets each --color-<key> to `theme.dark` there
export default (
  <div className="dark" style={{ background: "#171717", padding: 8, width: 560 }}>
    <ChartContainer
      id="afc-west-margin-dark"
      config={config}
      initialDimension={{ width: 560, height: 360 }}
      style={{ width: 560, height: 360 }}
    >
      <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <ReferenceLine y={0} />
        <XAxis dataKey="week" type="number" domain={[1, 18]} ticks={[1, 6, 12, 18]} tickLine={false} />
        <YAxis domain={[-150, 150]} ticks={[-150, -75, 0, 75, 150]} tickLine={false} width={40} />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(_, payload) => `Week ${payload[0]?.payload.week}`} />
          }
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
  </div>
);
