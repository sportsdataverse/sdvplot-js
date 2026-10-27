import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoTick } from "@sportsdataverse/sdvplot/recharts";
import { teamChartConfig } from "@sportsdataverse/sdvplot/shadcn";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../vendor/shadcn/chart.js";

export const meta = {
  title: "shadcn/ui: the AFC West's 2024 points scored, logos on the axis and in the tooltip",
  tags: ["react", "shadcn", "recharts", "teamChartConfig", "logoTick", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const { config, keys } = teamChartConfig("nfl", TEAMS);
const rows = TEAMS.map((team, i) => {
  const s = STANDINGS.find((t) => t.team === team);
  if (s === undefined) throw new Error(`${team} is not in STANDINGS`);
  // `key` finds the team's config (the tooltip's nameKey: its logo and name); `fill` paints the bar, as shadcn's do
  return { team, key: keys[i], pf: s.pf, fill: `var(--color-${keys[i]})` };
});

export default (
  <ChartContainer
    id="afc-west-points"
    config={config}
    initialDimension={{ width: 520, height: 340 }}
    style={{ width: 520, height: 340, background: "#ffffff" }}
  >
    <BarChart data={rows} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="team"
        interval={0}
        tickLine={false}
        height={44}
        tick={logoTick({ league: "nfl", size: 32 })}
      />
      <YAxis domain={[0, 450]} tickLine={false} width={40} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="key" hideLabel />} />
      <Bar dataKey="pf" radius={6} isAnimationActive={false} />
    </BarChart>
  </ChartContainer>
);
