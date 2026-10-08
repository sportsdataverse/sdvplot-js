import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { socialCard, toPNG } from "@sportsdataverse/sdvplot/export";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { JSDOM } from "jsdom";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "socialCard + toPNG: a figure framed 16:9 for a post, as a PNG (resvg, no browser)",
  tags: ["node", "network", "export", "socialCard", "toPNG", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const west = STANDINGS.filter((s) => s.division === "West");
// Points for (x) against points against (y, reversed: the best teams sit top right), grid lines every 40 points. No
// axis text: a build server may have no fonts for resvg to draw it with.
const every40 = [280, 320, 360, 400, 440];
const svg = Plot.plot({
  document: new JSDOM("").window.document, // Plot in Node
  width: 480,
  height: 300,
  inset: 30,
  axis: null,
  x: { domain: [280, 440] },
  y: { domain: [280, 440], reverse: true },
  marks: [
    Plot.gridX(every40),
    Plot.gridY(every40),
    Plot.frame(),
    logos(west, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.18 }),
  ],
});
// gt_social_crop's framing: pad, then widen the short side to 16:9, never cropping; toPNG downloads each logo once
const png = await toPNG(socialCard(svg.outerHTML, { aspect: "16:9", padding: 40, background: "#f4f4f4" }), {
  width: 640,
});
export default `<img src="data:image/png;base64,${Buffer.from(png).toString("base64")}" width="640" height="360" alt="The 2024 AFC West as team logos, points for against points against, framed 16:9: Kansas City, the Chargers, Denver and Las Vegas">`;
