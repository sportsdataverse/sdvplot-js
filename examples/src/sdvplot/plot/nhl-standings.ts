import * as Plot from "@observablehq/plot";
import { NHL_STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Standings: bars with logos on the axis",
  tags: ["plot", "axisLogos", "teamColor", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");
export default Plot.plot({
  height: 300,
  caption: "Atlantic Division points, 2025-26 regular season. Data: NHL api-web",
  marks: [
    Plot.barY(NHL_STANDINGS, { x: "team", y: "points", fill: "team", sort: { x: "-y" } }),
    axisLogos("x", { league: "nhl", height: 0.12 }),
  ],
  color: teamColor("nhl", { values: NHL_STANDINGS.map((s) => s.team) }),
});
