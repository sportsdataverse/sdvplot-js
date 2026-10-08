import { surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "surface(): any sport, any league, as SVG",
  tags: ["surface", "toSVG", "displayRange", "basketball", "nba"],
} satisfies ExampleMeta;

// One entry point for the nine sports; options are typed per sport, so "offense" is checked against basketball.
const court = surface("basketball", "nba", { displayRange: "offense" });

// `arcs: "svg"` writes each circle as an arc command instead of 200 sampled points: same drawing, smaller file.
export default toSVG(court, { width: 480, arcs: "svg" });
