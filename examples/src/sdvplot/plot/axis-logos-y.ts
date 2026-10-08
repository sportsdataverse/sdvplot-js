import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Horizontal bars with logos on the y axis",
  tags: ["plot", "axisLogos", "teamColor", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
export default Plot.plot({
  x: { label: "Point differential" },
  color: teamColor("nfl", { values: STANDINGS.map((s) => s.team) }),
  marks: [
    Plot.barX(STANDINGS, { x: (s) => s.pf - s.pa, y: "team", fill: "team", sort: { y: "-x" } }),
    // The y axis's tick labels become logos; a value that resolves to no team keeps its text.
    axisLogos("y", { league: "nfl", height: 0.08 }),
    Plot.ruleX([0]),
  ],
});
