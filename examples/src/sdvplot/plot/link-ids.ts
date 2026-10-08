import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { highlight } from "@sportsdataverse/sdvplot/interact";
import { linkIds } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Link ids on any Plot mark, lit by a class toggle",
  tags: ["plot", "linkIds", "highlight", "linked", "nfl"],
} satisfies ExampleMeta;

// Every dot and label carries its team as data-sdv-id, so one id lights both layers and the rest dim: a class
// toggle on the marks that changed, never a redraw. New England has no net EPA, so it has no dot to light.
const team = linkIds(STANDINGS, "team");
const svg = Plot.plot({
  grid: true,
  x: { label: "Wins" },
  y: { label: "Net EPA per play" },
  marks: [
    Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, fill: "currentColor", render: team }),
    Plot.text(STANDINGS, { x: "wins", y: "net_epa", text: "team", dy: -12, render: team }),
  ],
});
highlight(svg, new Set(["KC", "BUF"])); // the two division winners, until the pointer moves
svg.addEventListener("pointerover", (e) => {
  const id = (e.target as Element).closest("[data-sdv-id]")?.getAttribute("data-sdv-id");
  highlight(svg, id ? new Set([id]) : null);
});
export default svg;
