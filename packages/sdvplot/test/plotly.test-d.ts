import type { Image, Layout } from "plotly.js";
import { expectTypeOf, test } from "vitest";
import type { LayoutImage, PlotlyLayout } from "../src/plotly.js";

test("our layout image names only options plotly.js knows", () => {
  // xref/yref are validated strings ("x", "x2", "paper"); plotly.js types them as a closed template union
  expectTypeOf<Omit<LayoutImage, "xref" | "yref">>().toMatchTypeOf<Partial<Image>>(); // source, x, y, sizex, sizey, sizing, xanchor, yanchor, opacity, layer (+ name, which plotly.js accepts but its types omit)
  expectTypeOf<Image["xref"] | Image["yref"]>().toMatchTypeOf<LayoutImage["xref"]>();
  expectTypeOf<PlotlyLayout["margin"]>().toMatchTypeOf<Partial<Layout["margin"]> | undefined>();
});
