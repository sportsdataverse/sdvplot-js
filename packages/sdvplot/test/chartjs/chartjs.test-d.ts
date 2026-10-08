import type { loadImage } from "@napi-rs/canvas";
import type { ChartConfiguration, ChartDataset, Plugin } from "chart.js";
import { expectTypeOf, test } from "vitest";
import {
  type AxisLogoOptions,
  type HeadshotPointOptions,
  type ImageLike,
  type PointOptions,
  type WatermarkOptions,
  axisLogos,
  logoPoints,
  logoWatermarks,
  pointImages,
  teamColor,
  teamFill,
} from "../../src/chartjs.js";

test("point styles and team colours slot into Chart.js's own config types", () => {
  expectTypeOf(logoPoints([], { league: "nfl" })).toMatchTypeOf<Partial<ChartDataset<"scatter">>>();
  expectTypeOf(teamColor(["KC"], "nfl")).toEqualTypeOf<string[]>();
  expectTypeOf(teamColor("KC", "nfl")).toEqualTypeOf<string>();
  // the shape of Game on Paper's radar dataset (astro/src/utils/radar.ts:70-80), team colours only
  const radar: ChartConfiguration<"radar"> = {
    type: "radar",
    data: {
      labels: ["EPA/Play"],
      datasets: [
        {
          label: "KC",
          data: [80],
          fill: true,
          backgroundColor: teamFill("KC", "nfl"),
          borderColor: teamColor("KC", "nfl"),
          pointBackgroundColor: teamColor("KC", "nfl"),
        },
      ],
    },
    plugins: [pointImages],
  };
  const scatter: ChartConfiguration<"scatter"> = {
    type: "scatter",
    data: { datasets: [{ data: [{ x: 0, y: 0 }], ...logoPoints(["KC"], { league: "nfl" }) }] },
  };
  expectTypeOf([radar, scatter]).not.toBeNever();
});

test("axis logos and watermarks are plain plugins for bar and line configs", () => {
  expectTypeOf(axisLogos("x", { league: "nfl" })).toMatchTypeOf<Plugin>();
  expectTypeOf(logoWatermarks(["KC", "BUF"], { league: "nfl" })).toMatchTypeOf<Plugin>();
  const bar: ChartConfiguration<"bar"> = {
    type: "bar",
    data: { labels: ["KC"], datasets: [{ data: [1], backgroundColor: teamColor(["KC"], "nfl") }] },
    plugins: [axisLogos("x", { league: "nfl" })],
  };
  const wp: ChartConfiguration<"line"> = {
    type: "line",
    data: { labels: [0, 1], datasets: [{ data: [0.5, 0.6], borderColor: teamColor("KC", "nfl") }] },
    plugins: [logoWatermarks(["KC", "BUF"], { league: "nfl", size: 75, alpha: 0.4 })],
  };
  expectTypeOf([bar, wp]).not.toBeNever();
});

test("loadImage takes @napi-rs/canvas's loader as it is, and a DOM image is an ImageLike", () => {
  expectTypeOf<typeof loadImage>().toMatchTypeOf<NonNullable<PointOptions["loadImage"]>>();
  expectTypeOf<typeof loadImage>().toMatchTypeOf<NonNullable<HeadshotPointOptions["loadImage"]>>();
  expectTypeOf<typeof loadImage>().toMatchTypeOf<NonNullable<AxisLogoOptions["loadImage"]>>();
  expectTypeOf<typeof loadImage>().toMatchTypeOf<NonNullable<WatermarkOptions["loadImage"]>>();
  expectTypeOf<HTMLImageElement>().toMatchTypeOf<ImageLike>();
});
