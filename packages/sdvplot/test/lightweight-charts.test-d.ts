import type {
  ChartOptions,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  LineSeriesPartialOptions,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import { expectTypeOf, test } from "vitest";
import {
  type LwcAttached,
  type LwcSeriesPrimitive,
  logoMarkers,
  teamSeriesOptions,
  withAttribution,
} from "../src/lightweight-charts.js";

test("logoMarkers is a series primitive, and what Lightweight Charts attaches it with is what it reads", () => {
  expectTypeOf<LwcSeriesPrimitive>().toMatchTypeOf<ISeriesPrimitive<Time>>();
  expectTypeOf(logoMarkers([], { x: "t", y: "y", team: "team", league: "nfl" })).toMatchTypeOf<
    ISeriesPrimitive<Time>
  >();
  expectTypeOf<SeriesAttachedParameter<Time, "Line">>().toMatchTypeOf<LwcAttached>();
  expectTypeOf<IChartApi>().toMatchTypeOf<LwcAttached["chart"]>();
  expectTypeOf<ISeriesApi<"Line">>().toMatchTypeOf<LwcAttached["series"]>();
});

test("the options fit Lightweight Charts' own: createChart's and a LineSeries'", () => {
  expectTypeOf(withAttribution({ width: 640 })).toMatchTypeOf<DeepPartial<ChartOptions>>();
  const opts = {} as DeepPartial<ChartOptions>;
  expectTypeOf(withAttribution(opts)).toMatchTypeOf<DeepPartial<ChartOptions>>();
  expectTypeOf(
    teamSeriesOptions("KC", { league: "nfl", units: "probability" }),
  ).toMatchTypeOf<LineSeriesPartialOptions>();
});
