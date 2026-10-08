import * as Plot from "@observablehq/plot";
import {
  type Point,
  createDiamond,
  placeFeature,
  reflectCoords,
  rotateCoords,
} from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Placing, reflecting and rotating points",
  tags: ["plot", "transforms", "placeFeature", "reflectCoords", "rotateCoords"],
} satisfies ExampleMeta;

// A small off-centre shape, in its own frame.
const shape: Point[] = createDiamond(2, 1, [1, 0]);

const rows = [
  // placeFeature anchors the shape and, with reflectX/reflectY, mirrors it into the other quadrants
  // (how a court draws four corner marks from one): 4 rings.
  ...placeFeature(shape, { xAnchor: 6, yAnchor: 4, reflectX: true, reflectY: true }).map((ring) => ({
    ring,
    how: "placeFeature(…, reflectX, reflectY)",
  })),
  { ring: reflectCoords(shape, { overY: true }), how: "reflectCoords(…, { overY: true })" },
  { ring: rotateCoords(shape, 90), how: "rotateCoords(…, 90)" },
  { ring: shape, how: "the shape" },
];

export default Plot.plot({
  width: 640,
  aspectRatio: 1,
  inset: 10,
  color: { legend: true },
  marks: [
    Plot.ruleX([0]),
    Plot.ruleY([0]),
    ...rows.map(({ ring, how }) => Plot.line(ring, { stroke: () => how, strokeWidth: 2 })),
  ],
});
