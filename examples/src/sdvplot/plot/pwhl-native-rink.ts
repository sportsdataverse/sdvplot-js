import * as Plot from "@observablehq/plot";
import { PWHL_GOALS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "PWHL goals on the PWHL's own rink (no goaltender trapezoid): Boston at Montreal, 2 March 2024, in team colours",
  tags: ["plot", "surface", "centerLogo", "teamColor", "toSurfaceFrame", "hockeytech", "hockey", "pwhl"],
} satisfies ExampleMeta;

await loadLeague("pwhl");
// sdvplot knows PWHL teams by their HockeyTech team id (and full name), not by an abbreviation.
const ID = { BOS: "1", MTL: "3" } as const;
// Real goals (HockeyTech play-by-play), moved from HockeyTech's 600 x 300 canvas to rink feet from centre ice.
const goals = toSurfaceFrame(PWHL_GOALS, { from: "hockeytech" }).map((g) => ({ ...g, team_id: ID[g.team] }));

// The pwhl key draws sporty's native PWHL rink: the NHL's dimensions without the trapezoid behind each goal line.
const rink = surface("pwhl", { team: ID.MTL, centerLogo: true });
export default Plot.plot({
  ...rink.scales,
  width: 880,
  color: teamColor("pwhl", { values: goals.map((g) => g.team_id), legend: true }),
  marks: [
    ...rink.marks,
    Plot.dot(goals, {
      x: "surface_x",
      y: "surface_y",
      r: 8,
      fill: "team_id",
      stroke: "white",
      strokeWidth: 2,
    }),
    Plot.text(goals, {
      x: "surface_x",
      y: "surface_y",
      text: (g: (typeof goals)[number]) => `${g.scorer} (P${g.period} ${g.time})`,
      dy: -16,
      fill: "black",
      stroke: "white",
      strokeWidth: 3,
    }),
  ],
});
