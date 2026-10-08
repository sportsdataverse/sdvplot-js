import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { JSDOM } from "jsdom";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A figure as an SVG string in Node",
  tags: ["node", "ssr", "logos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const { document } = new JSDOM("").window;
const svg: string = Plot.plot({
  document,
  marks: [logos(STANDINGS, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.1 })],
}).outerHTML;

export default svg;
