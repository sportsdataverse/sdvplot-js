import * as Plot from "@observablehq/plot";
import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createSelection } from "@sportsdataverse/sdvplot";
import { brushFilter, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { linkIds } from "@sportsdataverse/sdvplot/plot";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "linkSelection: a brushable scatter and a hydrated table on one store",
  tags: ["plot", "linkSelection", "brushFilter", "linkIds", "linked", "table", "hydrate", "nfl"],
} satisfies ExampleMeta;

// One store links both views. Brush the chart: the table keeps the brushed teams, selected. Hover a dot: its row is
// underlined; hover or click a row: its dot lights. The ids match because the dots' id channel and the table's rowKey
// both read `team`. New England has no net EPA, so no dot: its row lights nothing, and a brush never holds it.
const team = linkIds(STANDINGS, "team");
const svg = Plot.plot({
  grid: true,
  x: { label: "Wins", domain: [0, 17] },
  y: { label: "Net EPA per play" },
  marks: [
    Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, fill: "currentColor", render: team }),
    Plot.text(STANDINGS, { x: "wins", y: "net_epa", text: "team", dy: -12, render: team }),
  ],
});
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.text("division"),
    c.int("wins"),
    c.int("losses"),
    c.num("net_epa", { digits: 3, label: "Net EPA" }),
  ])
  .title("AFC, 2024")
  .rowKey("team")
  .build();
const table = createTable(spec, STANDINGS, { sort: { col: "wins", dir: "desc" } });
const store = createSelection<Standing>();
linkSelection(store, { plot: svg });
linkSelection(store, { table });
brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
  x: [9.5, 16],
  y: [0, 0.2],
});
const host = document.createElement("div");
host.innerHTML = renderHTML(table, { fonts: false }); // rendered from the brushed engine, then hydrated: one state
hydrate(host.querySelector(".sdvt") as Element, table);
const root = document.createElement("div");
root.append(svg, host);
export default root;
