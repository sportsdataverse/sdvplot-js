import { KC_PHI_GAMES_2024, NFL_AIRPORTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoIconLayer, passArcLayer } from "@sportsdataverse/sdvplot/deckgl";
import { basemap } from "@sportsdataverse/sdvplot/maplibre";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "MapLibre GL JS with deck.gl: the Chiefs' and the Eagles' 2024 road trips as arcs over OpenFreeMap's dark basemap, through deck.gl's MapboxOverlay",
  tags: ["maplibre", "deckgl", "passArcLayer", "logoIconLayer", "basemap", "nfl", "map", "travel", "dark"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const airport = (team: string) => {
  const a = NFL_AIRPORTS.find((x) => x.team === team);
  if (a === undefined) throw new Error(`no airport for ${team}`);
  return a;
};
// Each 2024 road game of the two Super Bowl LIX teams, home airport to the host's (nflverse nfldata's airports)
const trips = KC_PHI_GAMES_2024.filter((g) => g.away_team === "KC" || g.away_team === "PHI").map((g) => {
  const [from, to] = [airport(g.away_team), airport(g.home_team)];
  return { team: g.away_team, lon: from.lon, lat: from.lat, lon_to: to.lon, lat_to: to.lat };
});
// The dark basemap's background is what the arc colours must read on (3:1). Each arc runs from the team's primary
// colour at home to its secondary at the host: the Chiefs' red to gold. The Eagles' midnight green does not read on
// it, so both ends of their arcs take the colour that does, their silver.
const { style, background } = basemap("dark");
const arcs = passArcLayer(trips, {
  x: "lon",
  y: "lat",
  xend: "lon_to",
  yend: "lat_to",
  team: "team",
  league: "nfl",
  background,
  width: 3,
});
const homes = logoIconLayer([airport("KC"), airport("PHI")], {
  x: "lon",
  y: "lat",
  team: "team",
  league: "nfl",
  variant: "dark",
  size: 40,
});

// In the browser this page calls mount with maplibre-gl's module, deck.gl's loader and the map's element.
export const browser = {
  lib: "maplibre",
  mount: async (
    {
      maplibregl,
      deck,
    }: {
      maplibregl: typeof import("maplibre-gl");
      // deck.gl's MapLibre overlay and the layers, loaded by the page
      deck: () => Promise<{
        MapboxOverlay: typeof import("@deck.gl/mapbox").MapboxOverlay;
        ArcLayer: typeof import("@deck.gl/layers").ArcLayer;
        IconLayer: typeof import("@deck.gl/layers").IconLayer;
      }>;
    },
    el: HTMLElement,
  ) => {
    const { MapboxOverlay, ArcLayer, IconLayer } = await deck();
    const map = new maplibregl.Map({
      container: el,
      style,
      bounds: [
        [-123, 30],
        [-72, 44],
      ],
      fitBoundsOptions: { padding: 32 },
    });
    await map.once("load");
    // deck.gl draws over the map, in its longitude and latitude, as a MapLibre control
    const overlay = new MapboxOverlay({ layers: [new ArcLayer(arcs), new IconLayer(homes)] });
    map.addControl(overlay);
    return { map, overlay };
  },
  width: 720,
  height: 420,
  label:
    "Dark map of the United States with the Kansas City Chiefs' and the Philadelphia Eagles' 2024 road trips as arcs in each team's colours, from its home airport to its host's, each team's logo at home",
} as const;

// Without JavaScript the page shows each team's arc colours and the number of trips.
export default {
  background,
  trips: arcs.data.length,
  colors: Object.fromEntries(arcs.data.map((a) => [a.team, { home: a.sourceColor, host: a.targetColor }])),
};
