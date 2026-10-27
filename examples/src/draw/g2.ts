import { Chart } from "@antv/g2";
import { type Draw, figureBox } from "./index.js";

/**
 * G2 5 on its canvas renderer, at the example's size. The chart is left on the box as `sdvG2` for the render test,
 * which reads where G2 put each mark from its scene graph and samples the canvas there.
 */
const draw: Draw<"g2"> = async (el, s) => {
  const box: HTMLElement & { sdvG2?: Chart } = figureBox(el, s.label);
  box.style.width = `${s.width}px`;
  const chart = new Chart({ container: box, width: s.width, height: s.height });
  chart.options(s.spec() as Parameters<Chart["options"]>[0]);
  await chart.render();
  box.sdvG2 = chart;
  return () => {
    chart.destroy();
    box.remove();
  };
};
export default draw;
