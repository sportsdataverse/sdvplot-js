import * as lwc from "lightweight-charts";
import { type Draw, figureBox } from "./index.js";

/**
 * Lightweight Charts, drawn by the example's own `mount` with the library's module. The chart paints its own white
 * background, so it reads on the docs' dark theme too. `mount` puts TradingView's attribution notice beside the
 * chart, inside the box. The box is a `figure`, not an `img`: the attribution logo is a link, a control. What `mount`
 * built (the chart, its series and their primitives) stays on the box as `sdvLwc`, for the render test.
 */
const draw: Draw<"lightweight-charts"> = async (el, s) => {
  const box = figureBox(el, s.label, "figure");
  box.style.display = "inline-block";
  const built = s.mount(lwc, box.appendChild(document.createElement("div")));
  Object.assign(box, { sdvLwc: built });
  return () => {
    built.chart.remove();
    box.remove();
  };
};
export default draw;
