import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, logoUrlSync } from "@sportsdataverse/sdvplot";
import { embedSources, withLogos } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Vega-Lite: logos inlined as data URIs, so the saved SVG shows them offline (embedSources)",
  tags: ["node", "network", "vega", "embedSources", "withLogos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The AFC West's two playoff teams of 2024.
const rows = STANDINGS.filter((s) => s.division === "West" && s.wins >= 11).map((s) => ({ ...s }));
// One fetch per distinct logo; the image layer then carries the bytes instead of the link.
const embed = await embedSources(rows.flatMap((r) => logoUrlSync(r.team, "nfl") ?? []));

const chart: TopLevelSpec = {
  width: 360,
  height: 260,
  data: { values: rows },
  mark: { type: "point", opacity: 0 },
  encoding: {
    x: { field: "pf", type: "quantitative", scale: { domain: [370, 420] }, title: "Points for" },
    y: { field: "pa", type: "quantitative", scale: { domain: [290, 340] }, title: "Points against" },
  },
};
const spec = withLogos(chart, rows, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.25, embed });
const view = new vega.View(vega.parse(compile(spec).spec), { renderer: "none" });
export default await view.toSVG();
