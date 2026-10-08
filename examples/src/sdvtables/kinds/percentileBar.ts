import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "percentileBar: a marker on a track",
  tags: ["kind", "percentileBar", "gt_percentile_bar"],
} satisfies ExampleMeta;

// With scale "auto" (the default), values that are all in [0, 1] are read as shares of the domain.
const rows = STANDINGS.map((r) => ({ ...r, win_share: r.wins / (r.wins + r.losses + r.ties) }));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [c.text("team"), c.percentileBar("win_share", { label: "Win %", domain: [0, 100] })])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, rows);
