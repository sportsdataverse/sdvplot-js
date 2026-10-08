import * as Plot from "@observablehq/plot";
import { NHL_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Shot map: EDM at FLA, 2024 Stanley Cup Final game 7, first period, on a Panthers rink; logos mark the goals",
  tags: ["plot", "surface", "logos", "teamColor", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");

// NHL api-web reports xCoord/yCoord in feet from centre ice, the frame sporty's NHL rink is drawn in, so the shots
// plot as captured with no toSurfaceFrame. In this period Florida shot at the -x end and Edmonton at the +x end.
const rink = surface("nhl", { team: "FLA" });
const at = { x: "x", y: "y", r: 5 } as const;
export default Plot.plot({
  ...rink.scales,
  width: 940,
  color: teamColor("nhl", { values: NHL_SHOTS.map((s) => s.team), legend: true }),
  marks: [
    ...rink.marks,
    // goals and shots on goal filled in the shooting team's colour, misses white with a ring in it
    Plot.dot(
      NHL_SHOTS.filter((s) => s.type !== "missed-shot"),
      { ...at, fill: "team", stroke: "white" },
    ),
    Plot.dot(
      NHL_SHOTS.filter((s) => s.type === "missed-shot"),
      { ...at, fill: "white", stroke: "team", strokeWidth: 2 },
    ),
    logos(
      NHL_SHOTS.filter((s) => s.type === "goal"),
      { league: "nhl", x: "x", y: "y", team: "team", height: 0.08 },
    ),
  ],
});
