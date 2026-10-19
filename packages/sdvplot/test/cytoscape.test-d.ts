import type cytoscape from "cytoscape";
import { expectTypeOf, test } from "vitest";
import { passNetwork, teamStylesheet } from "../src/cytoscape.js";

test("the elements and the stylesheet are Cytoscape 3.34's own definitions", () => {
  const net = passNetwork([], { from: "from", to: "to", team: "team", league: "nfl" });
  expectTypeOf(net.elements).toMatchTypeOf<cytoscape.ElementsDefinition>();
  expectTypeOf(net.style).toMatchTypeOf<cytoscape.StylesheetJson>();
  expectTypeOf(teamStylesheet({ league: "nfl", teams: ["KC"] })).toMatchTypeOf<cytoscape.StylesheetJson>();
});
