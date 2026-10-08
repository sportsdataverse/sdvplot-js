import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { titleImage } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A team logo in the title",
  tags: ["plot", "titleImage", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const kc = STANDINGS.filter((s) => s.team === "KC");
const chart = Plot.plot({
  height: 140,
  x: { label: "Points", domain: [0, 450] },
  y: { label: null },
  marks: [
    Plot.barX(
      kc.flatMap((s) => [
        { side: "Scored", points: s.pf },
        { side: "Allowed", points: s.pa },
      ]),
      { x: "points", y: "side", fill: "#e31837" },
    ),
    Plot.ruleX([0]),
  ],
});
// A bare <svg> needs `title`; a figure rendered with Plot.plot({ title }) keeps its own <h2>.
export default titleImage(chart, { image: "KC", league: "nfl", title: "Kansas City, 2024 regular season" });
