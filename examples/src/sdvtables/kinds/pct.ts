import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "pct: a share shown as a percentage",
  tags: ["kind", "pct"],
} satisfies ExampleMeta;

// pct multiplies by 100 (scale: true, the default): pass shares, not percentages.
const rows = STANDINGS.map((r) => ({ ...r, win_share: r.wins / (r.wins + r.losses + r.ties) }));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [c.text("team"), c.int("wins"), c.int("losses"), c.pct("win_share", { label: "Win %" })])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, rows);
