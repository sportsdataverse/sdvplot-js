import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Standings: bars with logos on the axis",
  tags: ["plot", "axisLogos", "teamColor", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
const standings = [
  { team: "LAL", wins: 14 },
  { team: "BOS", wins: 11 },
  { team: "GSW", wins: 7 },
];
export default Plot.plot({
  height: 300,
  marks: [
    Plot.barY(standings, { x: "team", y: "wins", fill: "team" }),
    axisLogos("x", { league: "nba", height: 0.12 }),
  ],
  color: teamColor("nba", { values: standings.map((s) => s.team) }),
});
