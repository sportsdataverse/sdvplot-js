import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withHeadshots, withWordmarks } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Vega-Lite: wins by team, the quarterback on top, the wordmark inside (an SVG in Node)",
  tags: ["node", "vega", "withHeadshots", "withWordmarks", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Each image sits at a row's (x, y): the headshot just above the bar, the wordmark halfway up it.
const rows = [...STANDINGS]
  .sort((a, b) => b.wins - a.wins)
  .map((s) => ({ ...s, qb_y: s.wins + 1.7, mark_y: s.wins / 2 }));
const chart: TopLevelSpec = {
  width: 480,
  height: 300,
  data: { values: rows },
  mark: { type: "bar", color: "#e8e8e8" },
  encoding: {
    x: { field: "team", type: "nominal", sort: null, axis: null },
    y: { field: "wins", type: "quantitative", scale: { domain: [0, 18] }, title: "Wins (2024)" },
  },
};
const headshots = withHeadshots(chart, rows, {
  league: "nfl",
  x: "team",
  y: "qb_y",
  player: "qb_espn_id",
  height: 0.14,
});
const spec = withWordmarks(headshots, rows, {
  league: "nfl",
  x: "team",
  y: "mark_y",
  team: "team",
  height: 0.05,
});

// In the browser: vegaEmbed(div, spec, { renderer: "svg" }), as this page does (the SVG names each mark, "KC logo").
export const browser = { lib: "vega", spec } as const;

const view = new vega.View(vega.parse(compile(browser.spec).spec), { renderer: "none" });
export default await view.toSVG();
