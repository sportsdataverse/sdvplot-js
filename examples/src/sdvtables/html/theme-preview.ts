import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, themePreview } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "themePreview: one table under several themes",
  tags: ["table", "themePreview", "gt_theme_preview", "theme", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .title("AFC, 2024")
  .build();
await prepare(spec);
// One HTML string per theme (all 20 when the list is left out), the first n rows, compact.
const previews = themePreview(spec, STANDINGS, ["sdv", "midnight", "tufte", "scoreboard"], { n: 3 });
export default Object.entries(previews)
  .map(([name, html]) => `<h4>${name}</h4>\n${html}`)
  .join("\n");
