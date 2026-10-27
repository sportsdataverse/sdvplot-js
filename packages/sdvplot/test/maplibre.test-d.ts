import type { GeoJSONSourceSpecification, LayerSpecification, Map as MapLibreMap, MapOptions } from "maplibre-gl";
import { expectTypeOf, test } from "vitest";
import type { LogoImageMap, LogoSymbols, RouteLines, basemap } from "../src/maplibre.js";

test("the sources, layers, map and style are MapLibre's own types", () => {
  expectTypeOf<LogoSymbols["source"]>().toMatchTypeOf<GeoJSONSourceSpecification>();
  expectTypeOf<RouteLines["source"]>().toMatchTypeOf<GeoJSONSourceSpecification>();
  expectTypeOf<LogoSymbols["layer"]>().toMatchTypeOf<LayerSpecification>();
  expectTypeOf<RouteLines["layer"]>().toMatchTypeOf<LayerSpecification>();
  expectTypeOf<MapLibreMap>().toMatchTypeOf<LogoImageMap>();
  expectTypeOf<ReturnType<typeof basemap>["style"]>().toMatchTypeOf<NonNullable<MapOptions["style"]>>();
  // negative control: a source is not a layer
  expectTypeOf<LogoSymbols["source"]>().not.toMatchTypeOf<LayerSpecification>();
});
