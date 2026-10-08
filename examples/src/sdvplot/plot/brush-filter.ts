import * as Plot from "@observablehq/plot";
import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createSelection, focusIds } from "@sportsdataverse/sdvplot";
import { brushFilter, highlight } from "@sportsdataverse/sdvplot/interact";
import { linkIds } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Brush a Plot scatter into a selection store",
  tags: ["plot", "brushFilter", "highlight", "linkIds", "linked", "nfl"],
} satisfies ExampleMeta;

// Drag a rectangle: the teams inside become the store's selection (lit, the rest dim) and the region becomes a row
// test that a linked table can apply to its own rows. The overlay sits behind the dots, so a dot still takes the
// pointer. New England has no net EPA, so no brush ever holds it.
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
const store = createSelection<Standing>();
const readout = document.createElement("p");
store.subscribe((state) => {
  highlight(svg, focusIds(state));
  const kept = STANDINGS.filter((r) => state.predicate?.(r)).map((r) => r.team);
  readout.textContent = state.predicate
    ? `Brushed: ${kept.join(", ") || "none"}`
    : "Drag on the chart to brush";
});
brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
  x: [9.5, 16],
  y: [0, 0.2],
});
const root = document.createElement("div");
root.append(svg, readout);
export default root;
