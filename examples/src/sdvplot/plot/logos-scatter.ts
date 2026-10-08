import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Logos at points-for vs points-against",
  tags: ["plot", "logos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
export default Plot.plot({
  grid: true,
  x: { label: "Points for" },
  y: { label: "Points against", reverse: true },
  marks: [logos(STANDINGS, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.1 })],
});
