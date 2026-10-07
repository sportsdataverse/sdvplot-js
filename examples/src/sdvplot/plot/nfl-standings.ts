import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Standings: bars with logos on the axis",
  tags: ["plot", "axisLogos", "teamColor", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const standings = [
  { team: "KC", wins: 14 },
  { team: "BUF", wins: 11 },
  { team: "NYJ", wins: 7 },
];
export default Plot.plot({
  height: 300,
  marks: [
    Plot.barY(standings, { x: "team", y: "wins", fill: "team" }),
    axisLogos("x", { league: "nfl", height: 0.12 }),
  ],
  color: teamColor("nfl", { values: standings.map((s) => s.team) }),
});
