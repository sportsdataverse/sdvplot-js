import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Volleyball courts: FIVB, USA Volleyball and NCAA side by side, and the offensive half",
  tags: ["plot", "surface", "displayRange", "volleyball", "fivb", "usa_volleyball", "ncaa_volleyball"],
} satisfies ExampleMeta;

// Courts are 18 x 9 m with the net at x = 0; the three keys draw their own rule set's lines and free zone.
const views = [
  { key: "fivb", displayRange: "full" },
  { key: "usa_volleyball", displayRange: "full" },
  { key: "ncaa_volleyball", displayRange: "offense" },
] as const;
const plots = views.map(({ key, displayRange }) => {
  const court = surface(key, { displayRange });
  return Plot.plot({ ...court.scales, width: 300, caption: `${key}: ${displayRange}`, marks: court.marks });
});
const div = document.createElement("div");
div.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:end";
div.append(...plots);
export default div;
