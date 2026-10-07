import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Shot map: rink in team colours, dots, logos",
  tags: ["plot", "surface", "logos", "teamColor", "toSurfaceFrame", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");

// HockeyTech events: default input columns x/y on the 850x400 canvas; the frame maps onto the whole rink.
const events = [
  { x: 640, y: 120, team: "BOS" },
  { x: 220, y: 260, team: "TOR" },
];
const shots = toSurfaceFrame(events, { from: "hockeytech-a" });
const rink = surface("nhl", { team: "BOS" });
export default Plot.plot({
  ...rink.scales,
  width: 940,
  color: teamColor("nhl", { values: shots.map((s) => s.team) }),
  marks: [
    ...rink.marks,
    Plot.dot(shots, { x: "surface_x", y: "surface_y", fill: "team", r: 5 }),
    logos(shots, { league: "nhl", x: "surface_x", y: "surface_y", team: "team", height: 0.08 }),
  ],
});
