import * as Plot from "@observablehq/plot";
import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Standings: bars with logos on the axis",
  tags: ["plot", "axisLogos", "teamColor", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// The Pacific Division, 2023-24 (stats.nba.com): `team` is the nickname ("Lakers"), which sdvplot resolves.
export default Plot.plot({
  height: 300,
  caption: "Pacific Division wins, 2023-24 regular season. Data: stats.nba.com",
  marks: [
    Plot.barY(NBA_STANDINGS, { x: "team", y: "wins", fill: "team", sort: { x: "-y" } }),
    axisLogos("x", { league: "nba", height: 0.12 }),
  ],
  color: teamColor("nba", { values: NBA_STANDINGS.map((s) => s.team) }),
});
