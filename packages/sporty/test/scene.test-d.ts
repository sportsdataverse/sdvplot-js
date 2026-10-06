import { expectTypeOf, test } from "vitest";
import type { Feature } from "../src/scene.js";
test("Feature is exhaustively switchable", () => {
  const f = (x: Feature): number => {
    switch (x.kind) {
      case "polygon":
        return 1;
      case "text":
        return 2;
      default: {
        const n: never = x;
        return n;
      }
    }
  };
  expectTypeOf(f).returns.toEqualTypeOf<number>();
});
