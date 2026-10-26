import { Chart } from "chart.js";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { sourceSans } from "./chartjs.js";
import { type Draw, figureBox } from "./index.js";

/**
 * The example's react-chartjs-2 element in a React root, in a box of the PNG's width, with the PNG's font (./chartjs.ts
 * registers Chart.js's pieces and loads it); the browser loads each image itself, so no `loadImage`. The chart is left
 * on the box as `sdvChart` for the render test, which samples where Chart.js put each mark.
 */
const draw: Draw<"react-chartjs-2"> = async (el, s) => {
  await sourceSans;
  const box: HTMLElement & { sdvChart?: Chart } = figureBox(el, s.label);
  box.style.maxWidth = `${s.width}px`;
  const root = createRoot(box);
  flushSync(() => root.render(s.chart()));
  // react-chartjs-2 builds the chart in an effect: a sync render runs it before flushSync returns; wait a frame or
  // two if not
  const canvas = box.querySelector("canvas");
  let chart = canvas === null ? undefined : Chart.getChart(canvas);
  for (let t = 0; canvas !== null && chart === undefined && t < 10; t++) {
    await new Promise(requestAnimationFrame);
    chart = Chart.getChart(canvas);
  }
  if (canvas === null || chart === undefined) {
    root.unmount();
    box.remove();
    throw new Error(`no react-chartjs-2 chart in "${s.label}"`);
  }
  // On a narrow screen it scales down as the PNG does (Chart.js maps pointer events through the CSS size)
  canvas.style.maxWidth = "100%";
  canvas.style.height = "auto";
  box.sdvChart = chart;
  return () => {
    root.unmount();
    box.remove();
  };
};
export default draw;
