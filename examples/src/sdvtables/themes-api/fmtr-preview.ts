import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { FMTR_THEME_NAMES, defineTable } from "@sportsdataverse/sdvtables";
import { prepare, themePreview } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The 27 reactablefmtr themes side by side",
  tags: ["theme", "reactablefmtr", "FMTR_THEME_NAMES", "themePreview", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("wins"),
    c.int("losses"),
    c.num("net_epa", { digits: 3 }),
  ])
  .title("AFC, 2024")
  .build();
await prepare(spec);
// FMTR_THEME_NAMES lists fmtr-cerulean ... fmtr-void; themePreview renders the first n rows under each, compact.
const previews = themePreview(spec, STANDINGS, FMTR_THEME_NAMES, { n: 3 });
export default Object.entries(previews)
  .map(([name, html]) => `<h4>${name}</h4>\n${html}`)
  .join("\n");
