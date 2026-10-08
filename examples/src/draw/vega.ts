import embed, { type VisualizationSpec } from "vega-embed";
import type { Draw } from "./index.js";

/**
 * vega-embed on the SVG renderer, with its actions menu (save as SVG or PNG, view the source) and tooltip handler.
 * The SVG names each mark for assistive technology (sdvplot's images read "KC logo"); the canvas renderer would not.
 */
const draw: Draw<"vega"> = async (el, s) => {
  const box = el.appendChild(document.createElement("div"));
  const result = await embed(box, s.spec as VisualizationSpec, { mode: "vega-lite", renderer: "svg" });
  return () => {
    result.finalize();
    box.remove();
  };
};
export default draw;
