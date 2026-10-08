import type { TopLevelSpec } from "vega-lite";
import { expectTypeOf, test } from "vitest";
import { type ImageLayer, withAxisLogos, withLogos } from "../src/vega.js";

test("the image layer is a valid Vega-Lite unit spec", () => {
  expectTypeOf<{ $schema: string; layer: [ImageLayer] }>().toMatchTypeOf<TopLevelSpec>();
});

test("vega-lite's own TopLevelSpec passes through the verbs unchanged", () => {
  const spec = { mark: "point" } as TopLevelSpec;
  expectTypeOf(
    withLogos(spec, [], { x: "x", y: "y", team: "team", league: "nfl" }),
  ).toEqualTypeOf<TopLevelSpec>();
  expectTypeOf(withAxisLogos(spec, "x", { league: "nfl" })).toEqualTypeOf<TopLevelSpec>();
});
