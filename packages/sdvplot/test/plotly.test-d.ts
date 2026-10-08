import type { Data, Image, Layout } from "plotly.js";
import { expectTypeOf, test } from "vitest";
import { type LayoutImage, type PlotlyLayout, withAxisLogos, withLogos } from "../src/plotly.js";

test("our layout image names only options plotly.js knows", () => {
  // xref/yref are validated strings ("x", "x2", "paper"); plotly.js types them as a closed template union
  expectTypeOf<Omit<LayoutImage, "xref" | "yref">>().toMatchTypeOf<Partial<Image>>(); // source, x, y, sizex, sizey, sizing, xanchor, yanchor, opacity, layer (+ name, which plotly.js accepts but its types omit)
  expectTypeOf<Image["xref"] | Image["yref"]>().toMatchTypeOf<LayoutImage["xref"]>();
  expectTypeOf<PlotlyLayout["margin"]>().toMatchTypeOf<Partial<Layout["margin"]> | undefined>();
});

test("plotly.js's own figure type passes through the verbs unchanged", () => {
  // A29/A43: the second, generic overload hands the caller's own type back
  type Figure = { data: Data[]; layout: Partial<Layout> };
  const fig = { data: [], layout: {} } as Figure;
  expectTypeOf(withLogos(fig, [], { x: "x", y: "y", team: "team", league: "nfl" })).toEqualTypeOf<Figure>();
  expectTypeOf(withAxisLogos(fig, "x", { league: "nfl" })).toEqualTypeOf<Figure>();
});
