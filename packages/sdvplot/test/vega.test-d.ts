import type { TopLevelSpec } from "vega-lite";
import { expectTypeOf, test } from "vitest";
import type { ImageLayer } from "../src/vega.js";

test("the image layer is a valid Vega-Lite unit spec", () => {
  expectTypeOf<{ $schema: string; layer: [ImageLayer] }>().toMatchTypeOf<TopLevelSpec>();
});
