import * as Plot from "@observablehq/plot";
import { SUPER_BOWL_LIX_TDS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Play map: Super Bowl LIX touchdowns from their line of scrimmage, on an Eagles field",
  tags: ["plot", "surface", "logos", "teamColor", "toSurfaceFrame", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

// ESPN plays: `yardline` is a 0-100 yardline from the home team's goal line; the frame spans the whole field.
// ESPN reports where along the field a play starts, not across it, so every play sits on the middle (y = 0).
const plays = toSurfaceFrame(
  SUPER_BOWL_LIX_TDS.map((p) => ({ ...p, y: 0 })),
  { from: "espn-football-0-100", x: "yardline" },
);
const field = surface("nfl", { team: "PHI" });
export default Plot.plot({
  ...field.scales,
  width: 940,
  color: teamColor("nfl", { values: plays.map((s) => s.team), legend: true }),
  marks: [
    ...field.marks,
    Plot.dot(plays, { x: "surface_x", y: "surface_y", fill: "team", stroke: "white", r: 5 }),
    logos(plays, { league: "nfl", x: "surface_x", y: "surface_y", team: "team", height: 0.07 }),
  ],
});
