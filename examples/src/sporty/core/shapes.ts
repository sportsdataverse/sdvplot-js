import * as Plot from "@observablehq/plot";
import {
  type Point,
  createCircle,
  createDiamond,
  createRectangle,
  createSquare,
  createXShape,
} from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The shape primitives surfaces are built from",
  tags: [
    "plot",
    "shapes",
    "createCircle",
    "createDiamond",
    "createRectangle",
    "createSquare",
    "createXShape",
  ],
} satisfies ExampleMeta;

// Each returns a ring of [x, y] points; a surface feature is one or more of them. Angles are in units of pi.
const shapes: { name: string; ring: Point[] }[] = [
  { name: "createCircle", ring: createCircle({ r: 1.5, npoints: 40 }) },
  { name: "createCircle (half)", ring: createCircle({ center: [5, -0.75], r: 1.5, start: 0, end: 1 }) },
  { name: "createDiamond", ring: createDiamond(3, 2, [10, 0]) },
  { name: "createRectangle", ring: createRectangle(13.5, 16.5, -1, 1) },
  { name: "createSquare", ring: createSquare(2.5, [20, 0]) },
  { name: "createXShape", ring: createXShape(3, 0.6).map(([x, y]): Point => [x + 25, y]) },
];
const labels = shapes.map(({ name, ring }) => ({
  name,
  x: ring.reduce((s, [x]) => s + x, 0) / ring.length,
}));

export default Plot.plot({
  width: 760,
  aspectRatio: 1,
  x: { axis: null },
  y: { axis: null, domain: [-2.6, 2] },
  marks: [
    ...shapes.map(({ ring }) => Plot.line(ring, { stroke: "steelblue", strokeWidth: 2 })),
    Plot.text(labels, { x: "x", y: -2.3, text: "name" }),
  ],
});
