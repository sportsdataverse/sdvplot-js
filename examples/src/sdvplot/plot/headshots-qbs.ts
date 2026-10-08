import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { headshots } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Quarterback headshots by team scoring",
  tags: ["plot", "headshots", "nfl"],
} satisfies ExampleMeta;

// ESPN player ids need no league data: headshots builds each URL from the id alone.
export default Plot.plot({
  grid: true,
  x: { label: "Points for" },
  y: { label: "Points against", reverse: true },
  marks: [
    headshots(STANDINGS, {
      league: "nfl",
      x: "pf",
      y: "pa",
      player: "qb_espn_id",
      title: "qb",
      height: 0.14,
    }),
  ],
});
