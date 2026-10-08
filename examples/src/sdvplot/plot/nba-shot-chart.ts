import * as Plot from "@observablehq/plot";
import { NBA_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Shot chart: LAL at DEN, fourth quarter, on a Nuggets court; logos mark the made threes",
  tags: ["plot", "surface", "logos", "teamColor", "toSurfaceFrame", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");

// stats.nba.com shots: columns x_legacy/y_legacy (the frame's defaults), tenths of a foot from the hoop.
// Every shot lands on the -x half, so draw the defensive half only: displayRange "defense".
const shots = toSurfaceFrame(NBA_SHOTS, { from: "nba-legacy" });
const court = surface("nba", { team: "DEN", displayRange: "defense" });
const at = { x: "surface_x", y: "surface_y", r: 5 } as const;
export default Plot.plot({
  ...court.scales,
  width: 940,
  color: teamColor("nba", { values: shots.map((s) => s.team), legend: true }),
  marks: [
    ...court.marks,
    // made shots filled in the shooting team's colour, misses white with a ring in it: both read on the paint
    Plot.dot(
      shots.filter((s) => s.made),
      { ...at, fill: "team", stroke: "white" },
    ),
    Plot.dot(
      shots.filter((s) => !s.made),
      { ...at, fill: "white", stroke: "team", strokeWidth: 2 },
    ),
    logos(
      shots.filter((s) => s.made && s.shot_type === "3PT Field Goal"),
      { league: "nba", x: "surface_x", y: "surface_y", team: "team", height: 0.08 },
    ),
  ],
});
