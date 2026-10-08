import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { appendWordmarks } from "@sportsdataverse/sdvplot/d3";
import * as d3 from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: wordmarks at points-for vs points-against",
  tags: ["d3", "appendWordmarks", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const [width, height] = [640, 400];
const x = d3.scaleLinear([280, 540], [40, width - 20]);
const y = d3.scaleLinear([280, 450], [height - 30, 20]);
const svg = d3.select(document.createElement("div")).append("svg").attr("viewBox", [0, 0, width, height]);
svg
  .append("g")
  .attr("transform", `translate(0,${height - 30})`)
  .call(d3.axisBottom(x));
svg.append("g").attr("transform", "translate(40,0)").call(d3.axisLeft(y));
appendWordmarks(
  svg,
  STANDINGS.map((s) => s.pf),
  STANDINGS.map((s) => s.pa),
  STANDINGS.map((s) => s.team),
  { league: "nfl", x: (v) => x(Number(v)), y: (v) => y(Number(v)), frameHeight: height, height: 0.06 },
);

export default svg.node();
