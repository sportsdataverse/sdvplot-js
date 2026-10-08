import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { type BinOf, binner, squarePath, squarebin } from "@sportsdataverse/sdvplot/bins";
import * as d3 from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: binning any x/y data into hexagons or squares",
  tags: ["d3", "bins", "binner", "squarebin", "squarePath", "squares"],
} satisfies ExampleMeta;

// sdvplot/bins knows nothing of basketball (it does not import sporty): give it points and x/y accessors. Here,
// Brooklyn's first 2000 shots of 2025-26 in tenths of a foot from the hoop, binned once by binner into hexagons of
// radius 15 and once by squarebin into squares of side 15, and drawn the d3-hexbin way: one path per cell,
// translated to its centre and shaded by its count.
type Shot = (typeof BKN_SHOTS_2026)[number];
const shots = BKN_SHOTS_2026.filter((s) => s.y_legacy <= 420);
const k = 0.6; // px per tenth of a foot
const [w, h] = [500 * k, 470 * k];
const x = d3.scaleLinear([-250, 250], [0, w]);
const y = d3.scaleLinear([-50, 420], [h, 0]);
const hex = binner({ radius: 15 });
const panels: { title: string; bins: BinOf<Shot>[]; path: string }[] = [
  {
    title: "binner({ radius: 15 })",
    bins: hex.bins(shots, { x: (s) => s.x_legacy, y: (s) => s.y_legacy }),
    path: hex.cell(15 * k),
  },
  {
    title: "squarebin(…, { side: 15 })",
    bins: squarebin(shots, { side: 15, x: (s) => s.x_legacy, y: (s) => s.y_legacy }),
    path: squarePath(15 * k),
  },
];

const most = d3.max(panels, (p) => d3.max(p.bins, (b) => b.length)) ?? 1;
const shade = d3.scaleSequentialLog(d3.interpolateBlues).domain([1, most]);
const svg = d3
  .create("svg")
  .attr("viewBox", [0, 0, 2 * w + 20, h + 24])
  .attr("width", 2 * w + 20);
panels.forEach((p, i) => {
  const g = svg.append("g").attr("transform", `translate(${i * (w + 20)},24)`);
  g.append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "none")
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.3);
  g.append("text")
    .attr("y", -8)
    .attr("font-size", 12)
    .attr("fill", "currentColor")
    .text(`${p.title}: ${p.bins.length} cells`);
  g.selectAll("path")
    .data(p.bins)
    .join("path")
    .attr("d", p.path)
    .attr("transform", (b) => `translate(${x(b.x)},${y(b.y)})`)
    .attr("fill", (b) => shade(b.length))
    .attr("stroke", "white")
    .attr("stroke-width", 0.3);
});
export default svg.node();
