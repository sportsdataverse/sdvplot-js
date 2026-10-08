import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamFill } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Bars in team colours, with a legend",
  tags: ["plot", "teamFill", "colors", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
export default Plot.plot({
  y: { label: "Points for", grid: true },
  x: { label: null },
  // values: the teams this chart shows (the default domain is every team id and abbreviation in the league).
  color: teamFill("nfl", { values: STANDINGS.map((s) => s.team), legend: true }),
  marks: [Plot.barY(STANDINGS, { x: "team", y: "pf", fill: "team", sort: { x: "-y" } }), Plot.ruleY([0])],
});
