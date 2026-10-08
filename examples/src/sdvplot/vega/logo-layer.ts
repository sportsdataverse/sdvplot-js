import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoLayer } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Vega-Lite: logoLayer in a layered spec of your own, over the average lines (an SVG in Node)",
  tags: ["node", "vega", "logoLayer", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = STANDINGS.map((s) => ({ ...s }));
// the dashed lines: these 8 teams' mean points for and against
const mean = (k: "pf" | "pa") => rows.reduce((t, r) => t + r[k], 0) / rows.length;
const height = 320;
// logoLayer is one image layer (its fields are "x" and "y") to drop into any layer list; the scales are shared.
const spec: TopLevelSpec = {
  width: 480,
  height,
  layer: [
    {
      data: { values: [{ pf: mean("pf"), pa: mean("pa") }] },
      mark: { type: "rule", strokeDash: [4, 4], color: "#888" },
      encoding: {
        x: { field: "pf", type: "quantitative", title: "Points for", scale: { domain: [260, 560] } },
      },
    },
    {
      data: { values: [{ pf: mean("pf"), pa: mean("pa") }] },
      mark: { type: "rule", strokeDash: [4, 4], color: "#888" },
      encoding: {
        y: { field: "pa", type: "quantitative", title: "Points against", scale: { domain: [280, 460] } },
      },
    },
    logoLayer(rows, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.12, chartHeight: height }),
  ],
};

// In the browser: vegaEmbed(div, spec, { renderer: "svg" }), as this page does (the SVG names each mark, "KC logo").
export const browser = { lib: "vega", spec } as const;

const view = new vega.View(vega.parse(compile(browser.spec).spec), { renderer: "none" });
export default await view.toSVG();
