import { colorKeys, surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Recolouring features with colorUpdates",
  tags: ["surface", "colorUpdates", "colorKeys", "basketball", "nba"],
} satisfies ExampleMeta;

// Any key of colorKeys("basketball") takes a colour; the rest keep the league's defaults.
const court = surface("basketball", "nba", {
  colorUpdates: {
    painted_area: "#552583",
    center_circle_fill: "#552583",
    two_point_range: "#fdb927",
    three_point_line: "#552583",
  },
});

export default `<figure style="margin:0">${toSVG(court, { width: 560, arcs: "svg" })}<figcaption>4 of the ${colorKeys("basketball").length} basketball colour keys changed</figcaption></figure>`;
