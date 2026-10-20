import { NBA_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { SurfaceBackdrop } from "@sportsdataverse/sdvplot/react";
import { teamColorPalette } from "@sportsdataverse/sdvplot/recharts";
import { surface, toSurfaceFrame } from "@sportsdataverse/sporty";
import { Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Recharts: LAL at DEN's fourth-quarter shots over a Nuggets-painted court",
  tags: ["react", "recharts", "SurfaceBackdrop", "teamColorPalette", "surface", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// stats.nba.com shots (x_legacy/y_legacy, tenths of a foot from the hoop), in court feet.
const shots = toSurfaceFrame(NBA_SHOTS, { from: "nba-legacy" }).map((s) => ({
  x: Number(s.surface_x),
  y: Number(s.surface_y),
  team: s.team,
  made: s.made,
}));
// the axes span the surface's bbox, so the court fills the plot area and one foot is one foot on both axes
const [x0, y0, x1, y1] = surface("basketball", "nba", { displayRange: "defense" }).bbox;
const width = 480;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const [lal, den] = teamColorPalette("nba", ["LAL", "DEN"]);
const byTeam = (team: string, made: boolean) => shots.filter((s) => s.team === team && s.made === made);

export default (
  <ScatterChart width={width} height={height} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
    <XAxis type="number" dataKey="x" domain={[x0, x1]} hide />
    <YAxis type="number" dataKey="y" domain={[y0, y1]} hide />
    <SurfaceBackdrop league="nba" team="DEN" displayRange="defense" />
    {/* made shots filled in the shooting team's colour, misses white with a ring in it */}
    <Scatter data={byTeam("LAL", true)} fill={lal} isAnimationActive={false} />
    <Scatter
      data={byTeam("LAL", false)}
      fill="#ffffff"
      stroke={lal}
      strokeWidth={2}
      isAnimationActive={false}
    />
    <Scatter data={byTeam("DEN", true)} fill={den} isAnimationActive={false} />
    <Scatter
      data={byTeam("DEN", false)}
      fill="#ffffff"
      stroke={den}
      strokeWidth={2}
      isAnimationActive={false}
    />
  </ScatterChart>
);
