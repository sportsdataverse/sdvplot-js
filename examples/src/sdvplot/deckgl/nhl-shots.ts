import { NHL_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoIconLayer, surfaceLayer } from "@sportsdataverse/sdvplot/deckgl";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "deck.gl: every shot of a Stanley Cup Final period as team logos on sporty's NHL rink (the props for deck.gl's layers)",
  tags: ["deckgl", "logoIconLayer", "surfaceLayer", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");
// NHL api-web's shot coordinates are feet from centre ice: the frame sporty draws its rink in, so no conversion. In
// this first period of game 7 (2024), Edmonton shot at the right-hand goal and Florida at the left.
const rink = surfaceLayer("hockey", "nhl");
const logos = logoIconLayer(NHL_SHOTS, { x: "x", y: "y", team: "team", league: "nhl", size: 26 });
// the view is fitted to the rink's own extent
const xs = rink.data.flatMap((d) => d.polygon.map((p) => p[0]));
const ys = rink.data.flatMap((d) => d.polygon.map((p) => p[1]));
// In the browser: new Deck({ views: new OrthographicView({ flipY: false }), layers: [new PolygonLayer(rink), ...] })
export const browser = {
  lib: "deckgl",
  layers: () => [
    { layer: "PolygonLayer", props: rink } as const,
    { layer: "IconLayer", props: logos } as const,
  ],
  bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  width: 720,
  height: 360,
  label:
    "The 27 shots of the first period of game 7 of the 2024 Stanley Cup Final on an NHL rink, each drawn as the shooting team's logo: Edmonton's at the right-hand goal, Florida's at the left",
} as const;

// deck.gl draws only in a browser; without JavaScript the page shows what the layers hold.
const teams = [...new Set(logos.data.map((d) => d.team))];
export default {
  rink: { features: rink.data.length, coordinateSystem: rink.coordinateSystem },
  logos: teams.map((team) => {
    const rows = logos.data.filter((d) => d.team === team);
    return { team, shots: rows.length, url: rows[0]?.icon.url };
  }),
};
