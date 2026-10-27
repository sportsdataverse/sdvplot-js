import type { ChartColorOptions, ChartSvgRenderer, DotOptions } from "@tanstack/charts";
import type { renderChartSvg } from "@tanstack/charts/svg";
import { expectTypeOf, test } from "vitest";
import {
  type TanstackColorScale,
  type TanstackDotMarkOptions,
  type TanstackImageDatum,
  logoDots,
  withPatterns,
} from "../src/tanstack.js";

// typed rows: TanStack checks a field channel against the row field it names
type Points = { team: string; pf: number; pa: number };

test("the sdvplot pieces are TanStack Charts 1.1's own types: dot options, a color option, an SVG serializer", () => {
  expectTypeOf<TanstackDotMarkOptions<"pf", "pa">>().toMatchTypeOf<DotOptions<TanstackImageDatum<Points>>>();
  expectTypeOf<TanstackColorScale<string>>().toMatchTypeOf<ChartColorOptions>();
  expectTypeOf<TanstackColorScale<number>>().toMatchTypeOf<ChartColorOptions>();
  const logos = logoDots([] as Points[], { x: "pf", y: "pa", team: "team", league: "nfl" });
  expectTypeOf(logos[0]?.options).toMatchTypeOf<DotOptions<TanstackImageDatum<Points>> | undefined>();
  expectTypeOf(withPatterns({} as typeof renderChartSvg, logos)).toMatchTypeOf<ChartSvgRenderer>();
});
