import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { wordmarks } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Wordmarks at the end of each bar",
  tags: ["plot", "wordmarks", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
export default Plot.plot({
  marginLeft: 40,
  x: { label: "Wins", domain: [0, 19] },
  y: { label: null },
  marks: [
    Plot.barX(STANDINGS, { x: "wins", y: "team", fill: "#ccc", sort: { y: "-x" } }),
    // A wordmark is centred on its point: an accessor puts the centre just past the bar's end.
    wordmarks(STANDINGS, { league: "nfl", x: (s) => s.wins + 1.8, y: "team", team: "team", height: 0.07 }),
    Plot.ruleX([0]),
  ],
});
