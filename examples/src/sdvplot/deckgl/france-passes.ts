import { WC2018_FINAL_FRANCE_PASSES } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { passArcLayer, surfaceLayer } from "@sportsdataverse/sdvplot/deckgl";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "deck.gl: France's first-half passes in the 2018 World Cup final as arcs, navy at the passer and mint at the receiver, both readable on the grass",
  tags: ["deckgl", "passArcLayer", "surfaceLayer", "soccer", "contrast"],
} satisfies ExampleMeta;

await loadLeague("soccer");
// sporty's pitch at the 105 x 68 m size SPADL uses, centred on the centre spot. The arcs sit on the grass, and France's
// colours are a navy and a pale mint: on sporty's dark default grass only the mint reads, so both ends of every arc
// would be mint and the direction lost. On a mid-tone grass both read (3:1 or better), so each pass runs navy (the
// passer) to mint (the receiver).
const grass = "#4a7f3a";
const pitch = surfaceLayer("soccer", "fifa", {
  updates: { pitch_length: 105, pitch_width: 68 },
  colorUpdates: { offensive_half_pitch: grass, defensive_half_pitch: grass, pitch_apron: grass },
});
// SPADL measures from the corner; the pitch is centred, so move each pass by half the pitch. France is ESPN team 478.
const passes = WC2018_FINAL_FRANCE_PASSES.map((p) => ({
  team: "478",
  from_x: p.start_x - 105 / 2,
  from_y: p.start_y - 68 / 2,
  to_x: p.end_x - 105 / 2,
  to_y: p.end_y - 68 / 2,
}));
// The grass is the background: every colour keeps 3:1 against it. tilt: 90 lays each arc flat on the pitch, so the
// top-down view shows its curve, and height: 0.3 keeps the curves low, inside the pitch.
const arcs = passArcLayer(passes, {
  x: "from_x",
  y: "from_y",
  xend: "to_x",
  yend: "to_y",
  team: "team",
  league: "soccer",
  idSystem: "team_id",
  background: grass,
  tilt: 90,
  height: 0.3,
});
const [first] = arcs.data;
if (first === undefined || first.sourceColor.join() === first.targetColor.join())
  throw new Error("the two ends of an arc share one colour: the direction would not show");
const xs = pitch.data.flatMap((d) => d.polygon.map((p) => p[0]));
const ys = pitch.data.flatMap((d) => d.polygon.map((p) => p[1]));
// In the browser: new Deck({ views: new OrthographicView({ flipY: false }), layers: [new PolygonLayer(pitch), ...] })
export const browser = {
  lib: "deckgl",
  layers: () => [
    { layer: "PolygonLayer", props: pitch } as const,
    { layer: "ArcLayer", props: arcs } as const,
  ],
  bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  width: 720,
  height: 470,
  label:
    "France's 75 completed first-half passes in the 2018 World Cup final as arcs from passer to receiver, attacking left to right, each running from France's navy at the passer to its mint at the receiver on a mid-green pitch",
} as const;

// deck.gl draws only in a browser; without JavaScript the page shows what the layers hold.
export default {
  grass,
  passes: arcs.data.length,
  sourceColor: arcs.data[0]?.sourceColor,
  targetColor: arcs.data[0]?.targetColor,
};
