import { type Frame, toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: write your own",
  tags: ["frames", "toSurfaceFrame", "Frame"],
} satisfies ExampleMeta;

// A Frame is two functions and a description. They see a view { x, y } of the chosen input columns and
// return feet on the surface, or null. Here: a basketball feed in inches from the centre circle.
const inches: Frame = {
  x: (r) => (typeof r.x === "number" ? r.x / 12 : null),
  y: (r) => (typeof r.y === "number" ? r.y / 12 : null),
  description: "inches from centre court",
};

export default toSurfaceFrame(
  [
    { px: 504, py: 0 },
    { px: -282, py: 120 },
  ],
  { from: inches, x: "px", y: "py" },
);
