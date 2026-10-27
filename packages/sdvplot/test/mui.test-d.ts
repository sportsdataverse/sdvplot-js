import type { BarSeriesType, ChartsAxisSlots, ChartsColorPalette } from "@mui/x-charts";
import type { MarkPlotSlots } from "@mui/x-charts/LineChart";
import type { ScatterMarkerSlots } from "@mui/x-charts/ScatterChart";
import { expectTypeOf, test } from "vitest";
import {
  type MuiColorPalette,
  type MuiMarkSlot,
  type MuiMarkerSlot,
  type MuiTickLabelSlot,
  teamColorGetter,
} from "../src/mui.js";

test("the sdvplot slots are MUI X Charts 9's own slot types: a scatter marker, a line mark, an axis tick label", () => {
  expectTypeOf<MuiMarkerSlot>().toMatchTypeOf<NonNullable<ScatterMarkerSlots["marker"]>>();
  expectTypeOf<MuiMarkSlot>().toMatchTypeOf<NonNullable<MarkPlotSlots["mark"]>>();
  expectTypeOf<MuiTickLabelSlot>().toMatchTypeOf<NonNullable<ChartsAxisSlots["axisTickLabel"]>>();
});

test("the colours are MUI's `colors` palette and a series' `colorGetter`", () => {
  expectTypeOf<MuiColorPalette>().toMatchTypeOf<ChartsColorPalette>();
  expectTypeOf(teamColorGetter("nfl", [])).toMatchTypeOf<NonNullable<BarSeriesType["colorGetter"]>>();
});
