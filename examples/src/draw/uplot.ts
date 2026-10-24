import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { type Draw, figureBox } from "./index.js";

/** uPlot at the example's size. Its axes and legend are dark ink on a transparent canvas, so the chart sits on white
 *  (a dark page would hide them); on a narrow screen the live output scrolls (docs CSS) rather than squeezing it. */
const draw: Draw<"uplot"> = async (el, s) => {
  const box = figureBox(el, s.label);
  box.style.background = "#ffffff";
  box.style.color = "#1c1e21"; // the legend's text
  box.style.display = "inline-block"; // white behind the chart only
  const chart = new uPlot(s.opts() as uPlot.Options, s.data as uPlot.AlignedData, box);
  return () => {
    chart.destroy();
    box.remove();
  };
};
export default draw;
