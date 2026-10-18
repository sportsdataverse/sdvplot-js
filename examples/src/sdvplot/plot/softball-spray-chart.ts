import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Spray chart on an NCAA softball field: Oklahoma and Texas batted balls (illustrative locations) in team colours",
  tags: ["plot", "surface", "teamColor", "softball", "ncaa_softball"],
} satisfies ExampleMeta;

await loadLeague("ncaa_softball");

// ILLUSTRATIVE batted balls, not real data: SDV has no softball hit locations. Each is a distance (ft) from home plate
// and a spray angle (degrees, 0 = straight to centre field, negative toward left field).
const HITS = [
  { team: "OU", feet: 205, angle: -30, result: "home run" },
  { team: "OU", feet: 150, angle: 12, result: "single" },
  { team: "OU", feet: 172, angle: 38, result: "double" },
  { team: "OU", feet: 95, angle: -8, result: "out" },
  { team: "OU", feet: 230, angle: 4, result: "home run" },
  { team: "TEX", feet: 140, angle: -40, result: "double" },
  { team: "TEX", feet: 120, angle: 25, result: "single" },
  { team: "TEX", feet: 60, angle: 15, result: "out" },
  { team: "TEX", feet: 185, angle: -12, result: "out" },
].map((h) => ({
  ...h,
  // sporty's softball origin is the back tip of home plate, +y toward centre field, +x toward first base
  x: h.feet * Math.sin((h.angle * Math.PI) / 180),
  y: h.feet * Math.cos((h.angle * Math.PI) / 180),
}));

// ncaa_softball is a team league and a surface: the field itself takes no team paint (softball has none), the
// teams' colours come from the same league.
const field = surface("ncaa_softball", { team: "OU" });
export default Plot.plot({
  ...field.scales,
  width: 720,
  color: teamColor("ncaa_softball", { values: HITS.map((h) => h.team), legend: true }),
  marks: [
    ...field.marks,
    Plot.link(HITS, { x1: 0, y1: 0, x2: "x", y2: "y", stroke: "team", strokeOpacity: 0.35 }),
    Plot.dot(HITS, {
      x: "x",
      y: "y",
      r: 6,
      fill: "team",
      stroke: "white",
      symbol: (h: (typeof HITS)[number]) => (h.result === "out" ? "times" : "circle"),
      tip: true,
      title: (h: (typeof HITS)[number]) => `${h.team} ${h.result}, ${h.feet} ft (illustrative)`,
    }),
  ],
});
