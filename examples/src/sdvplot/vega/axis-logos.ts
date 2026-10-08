import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorScale, withAxisLogos } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Vega-Lite: wins by team, logos on the axis, team-coloured bars (an SVG in Node)",
  tags: ["node", "vega", "withAxisLogos", "teamColorScale", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = STANDINGS.map((s) => ({ ...s }));
const teams = [...rows].sort((a, b) => b.wins - a.wins).map((r) => r.team);
const chart: TopLevelSpec = {
  width: 480,
  height: 300,
  data: { values: rows },
  mark: "bar",
  encoding: {
    x: { field: "team", type: "nominal", sort: teams, title: null },
    y: { field: "wins", type: "quantitative", title: "Wins (2024)" },
    color: { field: "team", type: "nominal", scale: teamColorScale("nfl", teams), legend: null },
  },
};
// The axis keeps its categories: their labels are blanked and an image layer draws a logo under each tick.
const spec = withAxisLogos(chart, "x", { league: "nfl", height: 0.1 });

// In the browser: vegaEmbed(div, spec, { renderer: "svg" }), as this page does (the SVG names each mark, "KC logo").
export const browser = { lib: "vega", spec } as const;

// Headless Vega: no DOM and no canvas, so the logos stay <image href> links the browser loads when it shows the SVG.
const view = new vega.View(vega.parse(compile(browser.spec).spec), { renderer: "none" });
export default await view.toSVG();
