import { NHL_STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorScale, withAxisLogos } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Vega-Lite: the Atlantic Division's points as horizontal bars, logos down the y axis (an SVG in Node)",
  tags: ["node", "vega", "withAxisLogos", "teamColorScale", "hockey", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");
const rows = NHL_STANDINGS.map((s) => ({ ...s }));
const teams = rows.map((r) => r.team); // already in division order, first to eighth
const chart: TopLevelSpec = {
  width: 440,
  height: 340,
  data: { values: rows },
  mark: "bar",
  encoding: {
    y: { field: "team", type: "nominal", sort: teams, title: null },
    x: { field: "points", type: "quantitative", title: "Points (2025-26)" },
    color: { field: "team", type: "nominal", scale: teamColorScale("nhl", teams), legend: null },
  },
};
// The y axis works like the x one: labels blanked, a logo left of each band. `height` is a fraction of the plot height.
const spec = withAxisLogos(chart, "y", { league: "nhl", height: 0.09 });

// In the browser: vegaEmbed(div, spec, { renderer: "svg" }), as this page does (the SVG names each mark, "BUF logo").
export const browser = { lib: "vega", spec } as const;

const view = new vega.View(vega.parse(compile(browser.spec).spec), { renderer: "none" });
export default await view.toSVG();
