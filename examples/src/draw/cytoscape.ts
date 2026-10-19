import cytoscape from "cytoscape";
import { type Draw, figureBox } from "./index.js";

/**
 * Cytoscape.js at the example's size, laid out at the nodes' own positions (the preset layout) and fitted to the box.
 * Drag to pan, or move a player; zooming is off so that scrolling the page past it still scrolls.
 */
const draw: Draw<"cytoscape"> = async (el, s) => {
  // a figure, not an img: the graph takes the pointer (pan, move a node)
  const box = figureBox(el, s.label, "figure");
  box.style.width = `${s.width}px`;
  box.style.height = `${s.height}px`;
  box.style.maxWidth = "100%";
  const cy = cytoscape({
    container: box,
    elements: s.elements() as cytoscape.ElementsDefinition,
    style: s.style as cytoscape.StylesheetJson,
    layout: { name: "preset", fit: true, padding: 32 },
    userZoomingEnabled: false,
    boxSelectionEnabled: false,
  });
  // the render test reads the graph from its box, to find a node and an edge on the canvas
  (box as HTMLElement & { sdvCy?: unknown }).sdvCy = cy;
  return () => {
    cy.destroy();
    box.remove();
  };
};
export default draw;
