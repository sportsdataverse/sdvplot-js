import * as Plot from "@observablehq/plot";
import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { loadLeague, matchupColorsSync } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Super Bowl LIX win probability, shaded in the leader's colour (Plot.differenceY + crosshairX)",
  tags: ["plot", "differenceY", "crosshairX", "matchupColors", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

// PHI's lead (home, above 50%) in PHI's colour, a KC lead in KC's; matchupColors picks a pair that differ from each
// other and read on white
const [phi, kc] = matchupColorsSync("PHI", "KC", { league: "nfl" }).light;
export default Plot.plot({
  width: 640,
  height: 300,
  caption:
    "Kansas City never led: Philadelphia's win probability never fell below 54.1%, so only Philadelphia's colour draws. Data: ESPN.",
  x: { label: "Minutes played →", domain: [0, 60] },
  y: { label: "↑ Philadelphia win probability", domain: [0, 1], tickFormat: "%" },
  marks: [
    Plot.differenceY(SUPER_BOWL_LIX_WP, {
      x: "minute",
      y1: 0.5,
      y2: "home_wp",
      positiveFill: phi,
      negativeFill: kc,
      fillOpacity: 0.6,
    }),
    Plot.ruleY([0.5], { strokeOpacity: 0.4 }),
    Plot.crosshairX(SUPER_BOWL_LIX_WP, { x: "minute", y: "home_wp" }),
  ],
});
