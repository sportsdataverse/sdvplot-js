import type uPlot from "uplot";
import { expectTypeOf, test } from "vitest";
import { type UPlotLike, type UPlotPlugin, logoPlugin, withTeamSeries } from "../src/uplot.js";

test("the plugin is a uPlot plugin, and a uPlot chart is what its rows function and drawnMarks take", () => {
  expectTypeOf<UPlotPlugin>().toMatchTypeOf<uPlot.Plugin>();
  expectTypeOf<uPlot>().toMatchTypeOf<UPlotLike>();
  const p = logoPlugin((u) => [{ x: u.data[0]?.[0] }], { x: "x", y: "y", team: "team", league: "nfl" });
  expectTypeOf(p).toMatchTypeOf<uPlot.Plugin>();
});

test("uPlot's own Options pass through withTeamSeries unchanged", () => {
  const opts = {} as uPlot.Options;
  expectTypeOf(withTeamSeries(opts, [], { team: "team", league: "nfl" })).toEqualTypeOf<uPlot.Options>();
});
