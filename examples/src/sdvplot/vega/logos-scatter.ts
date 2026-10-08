import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withLogos } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Vega-Lite: points for and against, with team logos (an SVG in Node)",
  tags: ["node", "vega", "withLogos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = STANDINGS.map((s) => ({ ...s }));
const chart: TopLevelSpec = {
  width: 480,
  height: 320,
  data: { values: rows },
  mark: { type: "point", opacity: 0 },
  encoding: {
    x: { field: "pf", type: "quantitative", scale: { domain: [260, 560] }, title: "Points for" },
    y: { field: "pa", type: "quantitative", scale: { domain: [280, 460] }, title: "Points against" },
  },
};
const spec = withLogos(chart, rows, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.12 });

// In the browser: vegaEmbed(div, spec, { renderer: "svg" }), as this page does (the SVG names each mark, "KC logo").
export const browser = { lib: "vega", spec } as const;

// Headless Vega: no DOM and no canvas, so the logos stay <image href> links the browser loads when it shows the SVG.
const view = new vega.View(vega.parse(compile(browser.spec).spec), { renderer: "none" });
export default await view.toSVG();
