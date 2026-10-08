import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, meanLines, medianLines } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Mean and median reference lines",
  tags: ["plot", "meanLines", "medianLines", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
export default Plot.plot({
  x: { label: "Points for" },
  y: { label: "Points against", reverse: true },
  marks: [
    // Red dashed rules at the means; the medians in a second style. Both reduce per facet.
    meanLines(STANDINGS, { x: "pf", y: "pa" }),
    medianLines(STANDINGS, { x: "pf", y: "pa", stroke: "steelblue", strokeDasharray: "1 3" }),
    logos(STANDINGS, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.09 }),
  ],
});
