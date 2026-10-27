import * as unovis from "@unovis/ts";
import { type Draw, figureBox } from "./index.js";

/**
 * What the drawer takes from `@unovis/ts`. Unovis's declarations resolve only under TypeScript's bundler resolution
 * (they re-export directories without file extensions) and this project resolves as Node does, so they are typed
 * here. Destructured by name, so webpack keeps only these and what they import: none of Leaflet, MapLibre or three.js.
 */
interface Unovis {
  SingleContainer: new (el: HTMLElement, config: object, data: object) => { destroy(): void };
  Graph: new (config: object) => object;
  Sankey: new (config: object) => object;
}
const { SingleContainer, Graph, Sankey } = unovis as unknown as Unovis;

/**
 * A Unovis Graph or Sankey with `@unovis/ts`, in a single container `width` by `height` px, in a box that carries the
 * example's `style` (a card's background, Unovis's `--vis-*` variables). The container stays on the box as
 * `sdvUnovis`, for the render test.
 */
const draw: Draw<"unovis"> = async (el, s) => {
  const box = figureBox(el, s.label, "figure");
  Object.assign(box.style, { width: `${s.width}px`, maxWidth: "100%" });
  for (const [k, v] of Object.entries(s.style ?? {})) box.style.setProperty(k, v);
  const component = new (s.component === "Graph" ? Graph : Sankey)(s.config());
  // its own element: Unovis sets the attributes of the one it is given (aria-label among them)
  const container = new SingleContainer(
    box.appendChild(document.createElement("div")),
    { component, height: s.height, ...(s.svgDefs === undefined ? {} : { svgDefs: s.svgDefs }) },
    s.data(),
  );
  Object.assign(box, { sdvUnovis: container });
  return () => {
    container.destroy();
    box.remove();
  };
};
export default draw;
