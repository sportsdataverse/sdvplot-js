import type { PerspectiveTheme } from "@sportsdataverse/sdvplot/perspective";
import { expectTypeOf, test } from "vitest";
import type { TableThemeSpec } from "../src/index.js";

test("a TableThemeSpec is a PerspectiveTheme: perspectiveConfig's theme takes tableThemeSpec(name, mode)", () => {
  expectTypeOf<TableThemeSpec>().toMatchTypeOf<PerspectiveTheme>();
  // negative controls: a spec without its sizes, or with a number for a face, is not one
  expectTypeOf<Omit<TableThemeSpec, "sizes">>().not.toMatchTypeOf<PerspectiveTheme>();
  expectTypeOf<{
    fonts: { body: number };
    sizes: { body: number };
    palette: { neg: string; pos: string };
  }>().not.toMatchTypeOf<PerspectiveTheme>();
});
