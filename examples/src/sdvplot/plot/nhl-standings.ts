import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Standings: bars with logos on the axis",
  tags: ["plot", "axisLogos", "teamColor", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");
const standings = [
  { team: "BOS", wins: 14 },
  { team: "TOR", wins: 11 },
  { team: "NYR", wins: 7 },
];
export default Plot.plot({
  height: 300,
  marks: [
    Plot.barY(standings, { x: "team", y: "wins", fill: "team" }),
    axisLogos("x", { league: "nhl", height: 0.12 }),
  ],
  color: teamColor("nhl", { values: standings.map((s) => s.team) }),
});
