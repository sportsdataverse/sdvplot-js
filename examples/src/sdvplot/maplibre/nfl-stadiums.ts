import { NFL_STADIUMS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { addLogoImages, basemap, drawnMarks, logoSymbols } from "@sportsdataverse/sdvplot/maplibre";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "MapLibre GL JS: every NFL team's logo at its 2024 home stadium, a native symbol layer over a free OpenFreeMap basemap",
  tags: ["maplibre", "logoSymbols", "addLogoImages", "basemap", "nfl", "map"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Each team's 2024 home stadium, joined by nflverse stadium_id to nfelo's stadium table (via nfl-data). The Rams and
// the Chargers share SoFi Stadium, and the Giants and the Jets MetLife Stadium, so one logo of each pair sits on the
// other.
const logos = logoSymbols(NFL_STADIUMS_2024, { x: "lon", y: "lat", team: "team", league: "nfl", size: 34 });
const { style } = basemap("light");

// In the browser this page calls mount with maplibre-gl's module and the map's element.
export const browser = {
  lib: "maplibre",
  mount: async ({ maplibregl }: { maplibregl: typeof import("maplibre-gl") }, el: HTMLElement) => {
    const map = new maplibregl.Map({
      container: el,
      style, // OpenFreeMap's credit shows in the map's attribution control, from the style's own source
      bounds: [
        [-124, 25],
        [-70, 48],
      ],
      fitBoundsOptions: { padding: 24 },
    });
    await map.once("load");
    // the logos as map images first (each fetched once), then the layer that draws them
    await addLogoImages(map, logos);
    map.addSource(logos.id, logos.source);
    map.addLayer(logos.layer);
    return { map };
  },
  width: 720,
  height: 440,
  label: "Map of the United States with each NFL team's logo at its 2024 home stadium",
} as const;

// MapLibre draws only in a browser (and the basemap's tiles come from OpenFreeMap); without JavaScript the page shows
// what the layer holds: each logo, its stadium and coordinates.
export default {
  logos: logos.source.data.features.length,
  images: logos.images.length,
  first: drawnMarks(logos).slice(0, 3),
};
