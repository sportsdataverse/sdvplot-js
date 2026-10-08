import type { CustomSeriesOption, EChartsOption as Upstream } from "echarts";
import { expectTypeOf, test } from "vitest";
import { type LogoSeries, withAxisLogos, withLogos } from "../src/echarts.js";

test("the custom series names only options echarts knows", () => {
  expectTypeOf<LogoSeries>().toMatchTypeOf<CustomSeriesOption>();
  expectTypeOf<{ series: [LogoSeries] }>().toMatchTypeOf<Upstream>();
});

test("echarts' own EChartsOption passes through the verbs unchanged", () => {
  const option = {} as Upstream;
  expectTypeOf(
    withLogos(option, [], { x: "x", y: "y", team: "team", league: "nfl" }),
  ).toEqualTypeOf<Upstream>();
  expectTypeOf(withAxisLogos(option, "x", { league: "nfl" })).toEqualTypeOf<Upstream>();
});
