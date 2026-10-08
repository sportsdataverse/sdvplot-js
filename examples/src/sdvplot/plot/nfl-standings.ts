import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Standings: bars with logos on the axis",
  tags: ["plot", "axisLogos", "teamColor", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
export default Plot.plot({
  height: 300,
  caption: "AFC West and East wins, 2024 regular season. Data: nflverse",
  marks: [
    Plot.barY(STANDINGS, { x: "team", y: "wins", fill: "team", sort: { x: "-y" } }),
    axisLogos("x", { league: "nfl", height: 0.12 }),
  ],
  color: teamColor("nfl", { values: STANDINGS.map((s) => s.team) }),
});
