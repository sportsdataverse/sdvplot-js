import { init } from "echarts";
import type { EChartsOption } from "echarts";
import { type Draw, figureBox } from "./index.js";

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
