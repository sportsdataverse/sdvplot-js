import type { CustomSeriesOption, EChartsOption as Upstream } from "echarts";
import { expectTypeOf, test } from "vitest";
import type { LogoSeries } from "../src/echarts.js";

test("the custom series names only options echarts knows", () => {
  expectTypeOf<LogoSeries>().toMatchTypeOf<CustomSeriesOption>();
  expectTypeOf<{ series: [LogoSeries] }>().toMatchTypeOf<Upstream>();
});
