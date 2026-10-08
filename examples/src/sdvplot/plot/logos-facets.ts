import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, meanLines } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Small multiples: AFC West and East, wins vs points for, each division's mean (mark-level fx)",
  tags: ["plot", "logos", "meanLines", "fx", "facets", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

export default Plot.plot({
  width: 640,
  height: 320,
  grid: true,
  x: { label: "Wins" },
  y: { label: "Points for" },
  marks: [
    ...meanLines(STANDINGS, { x: "wins", fx: "division" }),
    logos(STANDINGS, {
      league: "nfl",
      x: "wins",
      y: "pf",
      team: "team",
      fx: "division",
      height: 0.15,
      tip: true,
    }),
  ],
});
