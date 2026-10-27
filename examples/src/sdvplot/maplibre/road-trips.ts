import { KC_PHI_GAMES_2024, NFL_AIRPORTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { addLogoImages, basemap, logoSymbols, routeLines } from "@sportsdataverse/sdvplot/maplibre";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "MapLibre GL JS: the Chiefs' and the Eagles' 2024 road trips, airport to airport, each team's flights in its own colour",
  tags: ["maplibre", "routeLines", "logoSymbols", "addLogoImages", "basemap", "nfl", "map", "travel"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const airport = (team: string) => {
  const a = NFL_AIRPORTS.find((x) => x.team === team);
  if (a === undefined) throw new Error(`no airport for ${team}`);
  return a;
};
// Every 2024 regular-season road game of the two Super Bowl LIX teams, flown from the team's home airport to its
// host's (nflverse nfldata's airports). The Eagles' week 1 game in São Paulo was their home game on the schedule, so
// it is not a road trip here.
const legs = KC_PHI_GAMES_2024.filter((g) => g.away_team === "KC" || g.away_team === "PHI").map((g) => {
  const [from, to] = [airport(g.away_team), airport(g.home_team)];
  return {
    team: g.away_team,
    week: g.week,
    host: g.home_team,
    lon: from.lon,
    lat: from.lat,
    lon_to: to.lon,
    lat_to: to.lat,
  };
});
const routes = routeLines(legs, {
  x: "lon",
  y: "lat",
  xend: "lon_to",
  yend: "lat_to",
  team: "team",
  league: "nfl",
  width: 3,
});
// each team's logo at its home airport, where every trip starts
const homes = logoSymbols([airport("KC"), airport("PHI")], {
  x: "lon",
  y: "lat",
  team: "team",
  league: "nfl",
  size: 40,
});
const { style } = basemap("light");

// In the browser this page calls mount with maplibre-gl's module and the map's element.
export const browser = {
  lib: "maplibre",
  mount: async ({ maplibregl }: { maplibregl: typeof import("maplibre-gl") }, el: HTMLElement) => {
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
    await addLogoImages(map, homes);
    // the lines first, so the logos sit on top of the trips they start
    map.addSource(routes.id, routes.source);
    map.addLayer(routes.layer);
    map.addSource(homes.id, homes.source);
    map.addLayer(homes.layer);
    return { map };
  },
  width: 720,
  height: 420,
  label:
    "Map of the United States with the Kansas City Chiefs' 2024 road trips as red lines from Kansas City and the Philadelphia Eagles' as green lines from Philadelphia, each team's logo at its home airport",
} as const;

// Without JavaScript the page shows each flight and its colour.
export default routes.source.data.features.map((f) => ({
  team: f.properties.team,
  week: legs[f.id]?.week,
  to: legs[f.id]?.host,
  color: f.properties.color,
}));
