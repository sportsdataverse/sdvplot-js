import Plotly from "plotly.js-basic-dist-min";
import { type Draw, figureBox } from "./index.js";

/** plotly.js (the basic bundle: bar, scatter, pie) draws the figure; its hover, zoom and modebar come with it. */
const draw: Draw<"plotly"> = async (el, s) => {
  const box = figureBox(el, s.label);
  // newPlot writes into the figure it is given (trace uids, autoranges): draw a copy, the module's stays as written
  const { data, layout, config } = structuredClone(s.figure);
  await Plotly.newPlot(box, data, layout, { displaylogo: false, ...config });
  return () => {
    Plotly.purge(box);
    box.remove();
  };
};
export default draw;
