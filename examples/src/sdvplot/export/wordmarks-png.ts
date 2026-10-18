import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { toPNG } from "@sportsdataverse/sdvplot/export";
import { teamColor, wordmarks } from "@sportsdataverse/sdvplot/plot";
import { JSDOM } from "jsdom";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "toPNG with a bundled font: AFC West wins in team colours, each bar topped by its wordmark (resvg, no browser)",
  tags: ["node", "network", "export", "toPNG", "fonts", "wordmarks", "teamColor", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const west = [...STANDINGS.filter((s) => s.division === "West")].sort((a, b) => b.wins - a.wins);
const svg = Plot.plot({
  document: new JSDOM("").window.document, // Plot in Node
  width: 560,
  height: 340,
  marginTop: 50,
  x: { label: null, axis: null, domain: west.map((s) => s.team) },
  y: { label: "Wins (2024)", grid: true, domain: [0, 17] },
  color: teamColor("nfl", { values: west.map((s) => s.team) }),
  marks: [
    Plot.barY(west, { x: "team", y: "wins", fill: "team" }),
    Plot.ruleY([0]),
    wordmarks(west, { league: "nfl", x: "team", y: (s) => s.wins + 1.4, team: "team", height: 0.09 }),
  ],
}).outerHTML;

// resvg draws text only in fonts it has loaded: with `system: false` the axis is drawn in the bundled font alone, the
// same on a laptop and on a font-less CI runner. Source Sans 3, SIL Open Font License (examples/fonts/OFL.txt).
const font = join(dirname(fileURLToPath(import.meta.url)), "../../../fonts/SourceSans3-Regular.ttf");
const png = await toPNG(svg, {
  scale: 2, // twice the pixels, for a sharp image on a HiDPI screen
  background: "#ffffff",
  fonts: { files: [font], defaultFamily: "Source Sans 3", system: false },
});
export default `<img src="data:image/png;base64,${Buffer.from(png).toString("base64")}" width="560" height="340" alt="The 2024 AFC West's wins, best first: Kansas City, the Chargers, Denver and Las Vegas, each bar in its team's colour and topped by its wordmark">`;
