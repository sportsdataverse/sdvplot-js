import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoTick, teamColorPalette } from "@sportsdataverse/sdvplot/recharts";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Recharts: Pacific Division wins, logos on the axis and team-coloured bars on a dark chart",
  tags: ["react", "recharts", "logoTick", "teamColorPalette", "dark", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// The Pacific Division, 2023-24 (stats.nba.com): `team` is the nickname ("Lakers"), which sdvplot resolves.
const background = "#181a1b";
const teams = [...NBA_STANDINGS].sort((a, b) => b.wins - a.wins);
// with `background`, a team colour too dark to read on it (3:1) gives way to its other colour, or is lightened
const colors = teamColorPalette(
  "nba",
  teams.map((t) => t.team),
  { background },
);

export default (
  <div style={{ background, padding: 8, width: 520 }}>
    <BarChart width={520} height={320} data={teams} margin={{ top: 16, right: 16, bottom: 24, left: 0 }}>
      <CartesianGrid stroke="#3a3d3e" vertical={false} />
      <XAxis dataKey="team" interval={0} tickLine={false} tick={logoTick({ league: "nba", size: 36 })} />
      <YAxis domain={[0, 60]} stroke="#c8c6c3" />
      <Bar
        dataKey="wins"
        isAnimationActive={false}
        shape={(p: { x?: number; y?: number; width?: number; height?: number; index?: number }) => (
          <rect x={p.x} y={p.y} width={p.width} height={p.height} fill={colors[p.index ?? 0]} />
        )}
      />
    </BarChart>
  </div>
);
