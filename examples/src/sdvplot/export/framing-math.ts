import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import {
  canvasFor,
  checkColor,
  offsetFor,
  parseAspect,
  parseGravity,
  svgSize,
} from "@sportsdataverse/sdvplot/export";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { JSDOM } from "jsdom";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The framing math socialCard and sdvtables' socialCrop share",
  tags: ["node", "export", "svgSize", "canvasFor", "offsetFor", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const svg = Plot.plot({
  document: new JSDOM("").window.document,
  width: 480,
  height: 300,
  marks: [logos(STANDINGS, { league: "nfl", x: "pf", y: "pa", team: "team" })],
}).outerHTML;

const padding = 40;
const figure = svgSize(svg); // the root <svg>'s width and height (or its viewBox's)
const ratio = parseAspect("4:5"); // "16:9", "4x5" and plain numbers too
const padded = [figure.width + 2 * padding, figure.height + 2 * padding] as const;
const [width, height] = canvasFor(padded[0], padded[1], ratio); // the short side grows; nothing is cropped
// where the padded figure sits on that canvas, for three of the nine ImageMagick gravities
const at = (g: string) => offsetFor(width - padded[0], height - padded[1], parseGravity(g));
export default {
  figure: { width: figure.width, height: figure.height },
  ratio,
  canvas: { width, height },
  offsets: { north: at("north"), center: at("Center"), south: at("south") },
  background: checkColor("background", "#f4f4f4"), // a CSS colour, refused if it could break out of the markup
};
