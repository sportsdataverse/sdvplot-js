import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Lacrosse surfaces: the NCAA men's offensive half and an NLL box (oval boards, benches and penalty boxes)",
  tags: ["plot", "surface", "displayRange", "lacrosse", "ncaa_mlacrosse", "nll"],
} satisfies ExampleMeta;

// Lacrosse keys have no team identities, so they draw the plain surface (a team throws InputError). Native units
// differ by league: NCAA men's fields are in yards, NLL boxes in feet.
const views = [
  { key: "ncaa_mlacrosse", displayRange: "offense", width: 360 },
  { key: "nll", displayRange: "full", width: 560 },
] as const;
const plots = views.map(({ key, displayRange, width }) => {
  const field = surface(key, { displayRange });
  return Plot.plot({ ...field.scales, width, caption: `${key}: ${displayRange}`, marks: field.marks });
});
const div = document.createElement("div");
div.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:end";
div.append(...plots);
export default div;
