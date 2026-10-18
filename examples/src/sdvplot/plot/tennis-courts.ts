import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Tennis courts: the whole ATP court and its serving half, in the chair umpire's view",
  tags: ["plot", "surface", "displayRange", "tennis", "atp", "ncaa_tennis"],
} satisfies ExampleMeta;

// sporty's tennis courts are in feet in the chair umpire's view: the net runs along y at x = 0. The "serve" display
// range keeps the server's half and the net. atp, wta, itf, ita, usta and ncaa_tennis share one court geometry.
const views = [
  { key: "atp", displayRange: "full" },
  { key: "ncaa_tennis", displayRange: "serve" },
] as const;
const plots = views.map(({ key, displayRange }) => {
  const court = surface(key, { displayRange });
  return Plot.plot({
    ...court.scales,
    width: displayRange === "full" ? 560 : 300,
    caption: `${key}: ${displayRange}`,
    marks: court.marks,
  });
});
const div = document.createElement("div");
div.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:end";
div.append(...plots);
export default div;
