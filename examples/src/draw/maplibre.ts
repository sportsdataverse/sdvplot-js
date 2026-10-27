import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DeckOnMap } from "../contract.js";
import { type Draw, figureBox } from "./index.js";

// MapLibre 6 loads its worker from beside its own module (import.meta.url), which a bundler moves: point it at the
// worker file, which webpack emits as an asset of its own.
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

/** deck.gl's MapLibre overlay and layers, loaded only by an example that asks for them. */
async function deck(): Promise<DeckOnMap> {
  const [{ MapboxOverlay }, { ArcLayer, IconLayer }] = await Promise.all([
    import(/* webpackChunkName: "lib-deckgl-mapbox" */ "@deck.gl/mapbox"),
    import(/* webpackChunkName: "lib-deckgl-mapbox" */ "@deck.gl/layers"),
  ]);
  return { MapboxOverlay, ArcLayer, IconLayer };
}

/**
 * MapLibre GL JS, drawn by the example's own `mount` into a box of the example's size. The box is a `figure`, not an
 * `img`: the map is a control (drag, scroll, keyboard) and its attribution holds links. The map stays on the box as
 * `sdvMap`, and a deck.gl overlay as `sdvDeck` with its layers as `sdvDeckLayers`, for the render test.
 */
const draw: Draw<"maplibre"> = async (el, s) => {
  const box = figureBox(el, s.label, "figure");
  Object.assign(box.style, {
    position: "relative",
    width: `${s.width}px`,
    height: `${s.height}px`,
    maxWidth: "100%",
  });
  const { map, overlay, layers } = await s.mount({ maplibregl, deck }, box);
  Object.assign(box, { sdvMap: map, sdvDeck: overlay, sdvDeckLayers: layers });
  return () => {
    map.remove();
    box.remove();
  };
};
export default draw;
