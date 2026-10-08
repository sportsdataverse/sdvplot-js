import { contrast, hex6, luminance, mix, onColor, solid, teamColors } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Contrast and mixing of team colours",
  tags: ["contrast", "colors", "nfl"],
} satisfies ExampleMeta;

const [kc = "#e31837", lv = "#000000"] = await teamColors("nfl", ["KC", "LV"]);

export default {
  kc,
  lv,
  "hex6('#E18')": hex6("#E18"), // short and upper-case forms become #rrggbb
  "luminance(kc)": luminance(kc).toFixed(3),
  "contrast(kc, lv)": contrast(kc, lv).toFixed(2), // WCAG ratio; 4.5 is the body-text bar
  "onColor(kc)": onColor(kc), // black or white text on it
  "mix(kc, lv, 0.5)": mix(kc, lv, 0.5),
  "solid(`${kc}80`)": solid(`${kc}80`), // half-transparent over white, as an opaque colour
};
