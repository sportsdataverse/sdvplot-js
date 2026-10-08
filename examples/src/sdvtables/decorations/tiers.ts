import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, logoUrlSync } from "@sportsdataverse/sdvplot";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "tiers: a tier list, one row per tier",
  tags: ["decoration", "tiers", "gt_tiers", "nfl"],
} satisfies ExampleMeta;

// One row per tier: its label, then a logo URL per team (league-wide SRS rank) in the image columns.
await loadLeague("nfl");
const levels = ["SRS top 10", "11th to 20th", "21st to 32nd"];
const tierOf = (rank: number): string | undefined => levels[rank <= 10 ? 0 : rank <= 20 ? 1 : 2];
const rows = levels.map((tier) => {
  const logos = STANDINGS.filter((r) => tierOf(r.srs_rank) === tier).map(
    (r) => logoUrlSync(r.team, "nfl") ?? null,
  );
  return { tier, t1: logos[0] ?? null, t2: logos[1] ?? null, t3: logos[2] ?? null, t4: logos[3] ?? null };
});
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [c.text("tier"), c.text("t1"), c.text("t2"), c.text("t3"), c.text("t4")])
  .tiers(levels, "tier", ["t1", "t2", "t3", "t4"], {
    colors: ["#FF7F7F", "#FFDF7F", "#BFBFBF"],
    imgHeight: "44px",
    style: "light",
  })
  .title("AFC, 2024: SRS tiers")
  .build();
export default await renderHTMLAsync(spec, rows);
