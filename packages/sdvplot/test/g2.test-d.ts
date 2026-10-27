import type { AxisComponent, G2Spec, ImageMark } from "@antv/g2";
import { expectTypeOf, test } from "vitest";
import { type G2AxisLabels, type G2ColorScale, type G2ImageMark, logoMark } from "../src/g2.js";

test("the sdvplot pieces are G2 5's own types: an image mark, an axis option, a colour scale", () => {
  expectTypeOf<G2ImageMark>().toMatchTypeOf<ImageMark>();
  expectTypeOf<G2AxisLabels>().toMatchTypeOf<AxisComponent>();
  expectTypeOf<{ type: "interval"; scale: { color: G2ColorScale } }>().toMatchTypeOf<G2Spec>();
});

test("a mark goes in a view's children, as chart.options() takes it", () => {
  const mark = logoMark([], { x: "x", y: "y", team: "team", league: "nfl" });
  expectTypeOf({
    type: "view" as const,
    children: [{ type: "point" as const }, mark],
  }).toMatchTypeOf<G2Spec>();
});
