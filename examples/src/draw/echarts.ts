import type { EChartsOption } from "echarts";
import { BarChart, CustomChart, ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { type Draw, figureBox } from "./index.js";

// What the examples' options use, not the full build: a part left out would draw nothing of itself, which the Chromium
// test's tag-for-tag check against the server's SVG catches.
use([BarChart, CustomChart, ScatterChart, GridComponent, TooltipComponent, SVGRenderer]);

/** ECharts on its SVG renderer, at the size the server-side SVG was drawn. */
const draw: Draw<"echarts"> = async (el, s) => {
  const box = figureBox(el, s.label);
  const chart = init(box, null, { renderer: "svg", width: s.width, height: s.height });
  chart.setOption(s.option as EChartsOption);
  return () => {
    chart.dispose();
    box.remove();
  };
};
export default draw;
