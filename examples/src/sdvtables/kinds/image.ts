import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, logoUrlSync } from "@sportsdataverse/sdvplot";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "image: any image URL in the data",
  tags: ["kind", "image"],
} satisfies ExampleMeta;

// image draws the URL the row holds; here sdvplot's archive logo URL, added to each row.
await loadLeague("nfl");
const rows = STANDINGS.map((r) => ({ ...r, logo_url: logoUrlSync(r.team, "nfl") ?? null }));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.image("logo_url", { label: "", height: "40px", alt: "team" }),
    c.text("team"),
    c.text("qb"),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, rows);
