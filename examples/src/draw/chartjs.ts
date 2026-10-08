import { Chart, type ChartConfiguration, registerables } from "chart.js";
import font from "../../fonts/SourceSans3-Regular.ttf";
import type { Draw } from "./index.js";

Chart.register(...registerables);
// The PNG's font (Source Sans 3, SIL Open Font License, examples/fonts), so the labels match it. Loaded with this
// chunk, before the first chart: Chart.js measures text as it lays out and does not redraw when a font arrives.
const sourceSans = new FontFace("Source Sans 3", `url("${font}")`).load().then((f) => {
  document.fonts.add(f);
  Chart.defaults.font.family = "Source Sans 3";
});

/** Chart.js on a canvas of the PNG's size; the browser loads each image itself, so no `loadImage`. */
const draw: Draw<"chartjs"> = async (el, s) => {
  await sourceSans;
  const canvas = el.appendChild(document.createElement("canvas"));
  canvas.width = s.width;
  canvas.height = s.height;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", s.label);
  const chart = new Chart(canvas, s.config() as ChartConfiguration);
  return () => {
    chart.destroy();
    canvas.remove();
  };
};
export default draw;
