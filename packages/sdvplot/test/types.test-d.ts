import { expectTypeOf, test } from "vitest";
import type { IdSystem, MarkType, TeamId } from "../src/types.js";

test("TeamId is not assignable from string", () => {
  expectTypeOf<string>().not.toMatchTypeOf<TeamId>();
  expectTypeOf<TeamId>().toMatchTypeOf<string>();
  expectTypeOf<"logo">().toMatchTypeOf<MarkType>();
  // @ts-expect-error unknown id system
  const bad: IdSystem = "espn-id";
});
