import { loadLeague } from "@sportsdataverse/sdvplot";
import { appendSurface } from "@sportsdataverse/sdvplot/d3";
import * as d3 from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: a court in team colours",
  tags: ["d3", "appendSurface", "surface", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// An NBA court with its apron spans x -55..55 ft and y -30..30 ft; 6 px per foot.
const [width, height] = [660, 360];
const x = d3.scaleLinear([-55, 55], [0, width]);
const y = d3.scaleLinear([-30, 30], [height, 0]);
const svg = d3.select(document.createElement("div")).append("svg").attr("viewBox", [0, 0, width, height]);
appendSurface(svg, "nba", { team: "LAL", x, y });

export default svg.node();
