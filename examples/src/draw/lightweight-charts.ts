import { LineSeries, type Time, createChart } from "lightweight-charts";
import { type Draw, figureBox } from "./index.js";

/**
 * Lightweight Charts at the example's size, one line series per entry with its primitives attached, fitted to the
 * data. The chart paints its own white background, so it reads on the docs' dark theme too. The chart's attribution logo
 * is TradingView's link; `<Live>` shows the attribution notice under the figure (the tag `lightweight-charts`). The
 * box is a `figure`, not an `img`: the logo is a link, a control. The chart, its series and their primitives stay on
 * the box as `sdvLwc`, for the render test.
 */
const draw: Draw<"lightweight-charts"> = async (el, s) => {
  const box = figureBox(el, s.label, "figure");
  box.style.display = "inline-block";
  const host = box.appendChild(document.createElement("div"));
  const chart = createChart(host, { ...s.chart(), width: s.width, height: s.height });
  const primitives = s.series.map((x) => x.primitives?.() ?? []);
  const series = s.series.map((x, i) => {
    const line = chart.addSeries(LineSeries, x.options());
    line.setData(x.data.map((p) => ({ time: p.time as Time, value: p.value })));
    for (const p of primitives[i] ?? [])
      line.attachPrimitive(p as Parameters<typeof line.attachPrimitive>[0]);
    return line;
  });
  chart.timeScale().fitContent();
  Object.assign(box, { sdvLwc: { chart, series, primitives } });
  return () => {
    chart.remove();
    box.remove();
  };
};
export default draw;
