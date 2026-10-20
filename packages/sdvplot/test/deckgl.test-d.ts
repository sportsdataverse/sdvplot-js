import type { ArcLayerProps, IconLayerProps, PolygonLayerProps } from "@deck.gl/layers";
import { expectTypeOf, test } from "vitest";
import {
  type ArcRow,
  type IconRow,
  type SurfaceRow,
  logoIconLayer,
  passArcLayer,
  surfaceLayer,
} from "../src/deckgl.js";

test("each builder's props are deck.gl 9.4's own props for its layer", () => {
  const icons = logoIconLayer([], { x: "x", y: "y", team: "team", league: "nhl" });
  expectTypeOf(icons).toMatchTypeOf<IconLayerProps<IconRow>>();
  const arcs = passArcLayer([], { x: "x", y: "y", xend: "x2", yend: "y2", team: "team", league: "soccer" });
  expectTypeOf(arcs).toMatchTypeOf<ArcLayerProps<ArcRow>>();
  expectTypeOf(surfaceLayer("hockey", "nhl")).toMatchTypeOf<PolygonLayerProps<SurfaceRow>>();
});
