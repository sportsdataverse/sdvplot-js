import type { ViewerConfigUpdate } from "@perspective-dev/viewer";
import { expectTypeOf, test } from "vitest";
import type { PerspectiveConfig } from "../src/perspective.js";

test("the config is a ViewerConfigUpdate of Perspective 5.5.1: viewer.restore() takes it", () => {
  expectTypeOf<PerspectiveConfig>().toMatchTypeOf<ViewerConfigUpdate>();
  expectTypeOf<
    PerspectiveConfig & { group_by: string[]; split_by: string[] }
  >().toMatchTypeOf<ViewerConfigUpdate>();
  // negative control: a plugin that is not a string is not one
  expectTypeOf<{ plugin: number }>().not.toMatchTypeOf<ViewerConfigUpdate>();
});
