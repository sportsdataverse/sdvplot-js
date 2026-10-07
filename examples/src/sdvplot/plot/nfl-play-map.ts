import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Play map: field in team colours, dots, logos",
  tags: ["plot", "surface", "logos", "teamColor", "toSurfaceFrame", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

// ESPN plays: default input columns x/y, x a 0-100 yardline; the frame spans the whole field.
const rawPlays = [
  { x: 75, y: 5, team: "KC" },
  { x: 30, y: -10, team: "BUF" },
];
const plays = toSurfaceFrame(rawPlays, { from: "espn-football-0-100" });
const field = surface("nfl", { team: "KC" });
export default Plot.plot({
  ...field.scales,
  width: 940,
  color: teamColor("nfl", { values: plays.map((s) => s.team) }),
  marks: [
    ...field.marks,
    Plot.dot(plays, { x: "surface_x", y: "surface_y", fill: "team", r: 5 }),
    logos(plays, { league: "nfl", x: "surface_x", y: "surface_y", team: "team", height: 0.08 }),
  ],
});
