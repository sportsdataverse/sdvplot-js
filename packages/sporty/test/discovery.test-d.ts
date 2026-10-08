import { expectTypeOf, test } from "vitest";
import { surface } from "../src/index.js";
test("surface() options are typed per sport", () => {
  expectTypeOf(surface<"curling">)
    .parameter(2)
    .toMatchTypeOf<{ colorUpdates?: { house_rings?: string | readonly string[] } } | undefined>();
  // @ts-expect-error three_point_line is a basketball key, not a soccer key
  surface("soccer", "fifa", { colorUpdates: { three_point_line: "#000" } });
  // @ts-expect-error a soccer FEATURE name is not a colour key (colour keys distinguish the two half pitches)
  surface("soccer", "fifa", { colorUpdates: { half_pitch: "#000" } });
});
