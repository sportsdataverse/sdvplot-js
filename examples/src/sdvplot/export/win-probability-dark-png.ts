import * as Plot from "@observablehq/plot";
import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { loadLeague, matchupColorsSync } from "@sportsdataverse/sdvplot";
import { toPNG } from "@sportsdataverse/sdvplot/export";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { JSDOM } from "jsdom";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "toPNG on a dark background: Super Bowl LIX win probability in the matchup's dark-theme colours, logos at the final whistle (resvg, no browser)",
  tags: ["node", "network", "export", "toPNG", "matchupColors", "logos", "dark", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The pair chosen to read apart from each other and on a dark page: Philadelphia (home) first.
const [phi, kc] = matchupColorsSync("PHI", "KC", { league: "nfl" }).dark;
const last = SUPER_BOWL_LIX_WP[SUPER_BOWL_LIX_WP.length - 1]?.home_wp ?? 0.5;
// Each logo just past the 60th minute, at its team's final win probability.
const ends = ["PHI", "KC"].map((team, i) => ({ team, minute: 63.5, wp: i === 0 ? last : 1 - last }));
// No axis text: a build server may have no fonts for resvg (see the bundled-font example for drawing labels).
const svg = Plot.plot({
  document: new JSDOM("").window.document, // Plot in Node
  width: 640,
  height: 320,
  inset: 12,
  axis: null,
  x: { domain: [0, 66] },
  y: { domain: [0, 1] },
  marks: [
    Plot.gridX([15, 30, 45, 60], { stroke: "#ffffff", strokeOpacity: 0.15 }),
    Plot.ruleY([0.5], { stroke: "#ffffff", strokeOpacity: 0.4, strokeDasharray: "4 4" }),
    Plot.line(SUPER_BOWL_LIX_WP, { x: "minute", y: "home_wp", stroke: phi, strokeWidth: 2.5 }),
    Plot.line(SUPER_BOWL_LIX_WP, { x: "minute", y: (p) => 1 - p.home_wp, stroke: kc, strokeWidth: 2.5 }),
    logos(ends, { league: "nfl", x: "minute", y: "wp", team: "team", height: 0.16 }),
  ],
}).outerHTML;

// `background` fills under the figure; with no `color`, the root text colour turns white, the one that reads on it.
const png = await toPNG(svg, { background: "#16181d" });
export default `<img src="data:image/png;base64,${Buffer.from(png).toString("base64")}" width="640" height="320" alt="Super Bowl LIX win probability by minute on a dark background, Philadelphia's line climbing to the top and Kansas City's falling to the bottom, each ending at its team's logo">`;
