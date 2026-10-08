import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { parseHTML } from "linkedom";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The same figure under linkedom",
  tags: ["node", "ssr", "linkedom", "logos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// linkedom is a lighter DOM than jsdom: enough for Plot to build the SVG, no layout.
const { document } = parseHTML("<!doctype html><html><body></body></html>");
const svg: string = Plot.plot({
  document,
  marks: [logos(STANDINGS, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.1 })],
}).outerHTML;

export default svg;
