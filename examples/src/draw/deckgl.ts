import { Deck, OrthographicView } from "@deck.gl/core";
import { ArcLayer, IconLayer, PolygonLayer } from "@deck.gl/layers";
import { type Draw, figureBox } from "./index.js";

const LAYERS = { PolygonLayer, IconLayer, ArcLayer } as const;

/**
 * deck.gl at the example's size, top down (an OrthographicView with y up) and fitted to the surface's bounds; every
 * layer is drawn in the surface's own coordinates. Drag to pan, scroll to zoom.
 */
const draw: Draw<"deckgl"> = async (el, s) => {
  // a figure, not an img: deck.gl's controller makes the canvas a keyboard control (pan and zoom)
  const box = figureBox(el, s.label, "figure");
  box.style.position = "relative";
  box.style.width = `${s.width}px`;
  box.style.height = `${s.height}px`;
  box.style.maxWidth = "100%";
  const [x0, y0, x1, y1] = s.bounds;
  const layers = s.layers().map(({ layer, props }) => {
    const Layer = LAYERS[layer] as new (p: object) => InstanceType<(typeof LAYERS)[typeof layer]>;
    // pickable: the render test picks what deck.gl drew under a mark (no handler here, so nothing on the page reacts)
    return new Layer({ ...props, coordinateSystem: "cartesian", pickable: true });
  });
  const deck = new Deck({
    parent: box,
    width: s.width,
    height: s.height,
    views: new OrthographicView({ flipY: false }),
    initialViewState: {
      target: [(x0 + x1) / 2, (y0 + y1) / 2, 0],
      zoom: Math.log2(Math.min(s.width / (x1 - x0), s.height / (y1 - y0))),
    },
    controller: true,
    layers,
  });
  // the render test reads the deck from its box, to project a mark and sample what is drawn there
  (box as HTMLElement & { sdvDeck?: unknown }).sdvDeck = deck;
  return () => {
    deck.finalize();
    box.remove();
  };
};
export default draw;
