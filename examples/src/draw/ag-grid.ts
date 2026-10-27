import * as ag from "ag-grid-community";
import { type Draw, figureBox } from "./index.js";

/**
 * An AG Grid, drawn by the example's own `mount` with ag-grid-community's module, in a box at most `width` px wide
 * (and `height` tall, if given). The box is a `figure`: the grid inside is interactive (sorting, filters, scrolling).
 * The grid's API stays on the box as `sdvAgGrid`, for the render test.
 */
const draw: Draw<"ag-grid"> = async (el, s) => {
  const box = figureBox(el, s.label, "figure");
  box.style.maxWidth = `${s.width}px`;
  if (s.height !== undefined) box.style.height = `${s.height}px`;
  const api = s.mount(ag, box);
  Object.assign(box, { sdvAgGrid: api });
  return () => {
    api.destroy();
    box.remove();
  };
};
export default draw;
