import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorScale } from "@sportsdataverse/sdvplot/d3";
import * as d3 from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: bars through a team colour scale",
  tags: ["d3", "teamColorScale", "colors", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const [width, height] = [640, 400];
const teams = STANDINGS.map((s) => s.team);
const color = teamColorScale("nfl", { values: teams }); // team -> primary colour; unknown -> "grey"
const x = d3.scaleBand(teams, [40, width - 20]).padding(0.2);
const y = d3.scaleLinear([0, 17], [height - 30, 20]);
const svg = d3.select(document.createElement("div")).append("svg").attr("viewBox", [0, 0, width, height]);
svg
  .append("g")
  .selectAll("rect")
  .data(STANDINGS)
  .join("rect")
  .attr("x", (s) => x(s.team) ?? 0)
  .attr("y", (s) => y(s.wins))
  .attr("width", x.bandwidth())
  .attr("height", (s) => y(0) - y(s.wins))
  .attr("fill", (s) => color(s.team));
svg
  .append("g")
  .attr("transform", `translate(0,${height - 30})`)
  .call(d3.axisBottom(x));
svg.append("g").attr("transform", "translate(40,0)").call(d3.axisLeft(y));

export default svg.node();
