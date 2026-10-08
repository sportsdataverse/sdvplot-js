import * as Plot from "@observablehq/plot";
import { logoUrl, logoUrlSync } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "One franchise's logo by season",
  tags: ["logoUrl", "seasons", "nfl"],
} satisfies ExampleMeta;

// logoUrl loads the league itself; logoUrlSync needs it loaded, which the first call just did.
const rows = [
  { season: "2010", src: await logoUrl("LV", "nfl", { season: 2010 }) },
  { season: "2019", src: logoUrlSync("LV", "nfl", { season: 2019 }) },
  { season: "2024", src: logoUrlSync("LV", "nfl", { season: 2024 }) },
];

export default Plot.plot({
  height: 140,
  y: { axis: null },
  x: { type: "point", label: null }, // seasons as categories, not numbers
  marks: [Plot.image(rows, { x: "season", src: "src", width: 80, height: 80, frameAnchor: "middle" })],
});
