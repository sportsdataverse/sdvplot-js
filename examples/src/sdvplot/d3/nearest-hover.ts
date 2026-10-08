import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { createSelection, toId } from "@sportsdataverse/sdvplot";
import { linkSelection, nearestHover } from "@sportsdataverse/sdvplot/interact";
import { fgPctByDistance } from "@sportsdataverse/sdvplot/shots";
import * as d3 from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "nearestHover: the nearest shot within 18 px, linked to distance bars",
  tags: ["d3", "nearestHover", "tooltip", "linkSelection", "linked", "shots", "nba"],
} satisfies ExampleMeta;

// Two d3 figures of Brooklyn's first 2000 shots of 2025-26 share one store, keyed by distance in feet. They hover the
// NEAREST mark rather than the element under the pointer, as blazing-the-nets' d3 charts do: on the shot chart, a
// shot within 18 px (a Delaunay search); on the bars, the foot under the pointer's x alone, with a 5 px dead margin.
// Either way every shot from that distance lights, the rest dim, and a tooltip shows at the mark.
const bins = fgPctByDistance(BKN_SHOTS_2026, 1, 35); // feet 0 to 35
const label = (id: string): { lines: string[] } | null => {
  const b = bins[Number(id)];
  if (b === undefined) return null; // the heaves from 38 and 39 ft have no bar: they hover, with no tooltip
  return {
    lines: [
      `${b.distance} ft`,
      `${b.makes} of ${b.attempts} made`,
      `${(100 * b.share).toFixed(1)}% of shots`,
    ],
  };
};
const store = createSelection();

const k = 0.8; // px per tenth of a foot, hoop at x_legacy = y_legacy = 0
const at = (s: (typeof BKN_SHOTS_2026)[number]): [number, number] => [
  k * (s.x_legacy + 250),
  k * (420 - s.y_legacy),
];
const court = d3
  .create("svg")
  .attr("viewBox", [0, 0, 500 * k, 470 * k])
  .attr("width", 500 * k);
court
  .append("circle")
  .attr("cx", 250 * k)
  .attr("cy", 420 * k)
  .attr("r", 7.5 * k)
  .attr("fill", "none")
  .attr("stroke", "currentColor");
court
  .selectAll("circle.shot")
  .data(BKN_SHOTS_2026)
  .join("circle")
  .attr("class", "shot")
  .attr("data-sdv-id", (s) => toId(s.shot_distance)) // the link id: the shot's distance, as the bars stamp theirs
  .attr("cx", (s) => at(s)[0])
  .attr("cy", (s) => at(s)[1])
  .attr("r", 2.5)
  .attr("fill", (s) => (s.shot_result === "Made" ? "currentColor" : "none"))
  .attr("stroke", "currentColor")
  .attr("stroke-width", 0.6);
const courtNode = court.node() as SVGSVGElement;
linkSelection(store, { figure: courtNode, hover: false }); // the store lights the marks; nearestHover writes hover
nearestHover(courtNode, store, {
  points: BKN_SHOTS_2026.map((s) => ({ x: at(s)[0], y: at(s)[1], id: toId(s.shot_distance) })),
  radius: 18,
  label,
});

const [w, h] = [500 * k, 170];
const x = d3.scaleLinear([0, 36], [0, w]);
const y = d3.scaleLinear([0, d3.max(bins, (b) => b.share) ?? 1], [h, 12]);
const bars = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w);
bars
  .selectAll("rect")
  .data(bins)
  .join("rect")
  .attr("data-sdv-id", (b) => toId(b.distance))
  .attr("x", (b) => x(b.distance) + 0.5)
  .attr("width", x(1) - x(0) - 1)
  .attr("y", (b) => y(b.share))
  .attr("height", (b) => h - y(b.share))
  .attr("fill", "currentColor");
const barsNode = bars.node() as SVGSVGElement;
linkSelection(store, { figure: barsNode, hover: false });
nearestHover(barsNode, store, {
  points: bins.map((b) => ({ x: x(b.distance + 0.5), y: y(b.share), id: toId(b.distance) })),
  dimension: "x", // the bar under the pointer's x, however far below its top the pointer is
  padding: 5,
  label,
});

const root = document.createElement("div");
root.append(courtNode, barsNode);
export default root;
