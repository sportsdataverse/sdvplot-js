import { surface } from "@sportsdataverse/sporty";
import { appendSurface } from "@sportsdataverse/sporty/d3";
import * as d3 from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: appendSurface through your scales",
  tags: ["d3", "appendSurface", "soccer", "nwsl"],
} satisfies ExampleMeta;

// appendSurface draws a scene into a d3 selection through the x/y scale functions you pass,
// so the surface and your data share one coordinate system. It returns the <g> it appended.
const field = surface("soccer", "nwsl", { arcResolution: 48 }); // 48 points per arc: plenty at 720 px
const [x0, y0, x1, y1] = field.bbox;
const width = 720;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const x = d3.scaleLinear([x0, x1], [0, width]);
const y = d3.scaleLinear([y0, y1], [height, 0]);

const svg = d3.select(document.createElement("div")).append("svg").attr("viewBox", [0, 0, width, height]);
appendSurface(svg, field, x, y);
svg.append("circle").attr("cx", x(-40)).attr("cy", y(5)).attr("r", 6).attr("fill", "#b2182b"); // 40 yd left of centre (NWSL pitches are in yards)

export default svg.node();
