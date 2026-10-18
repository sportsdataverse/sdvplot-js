import { NHL_STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "NHL standings: grouped, striped, with a record tally and a points-% bar",
  tags: ["table", "recipe", "groupBy", "groupStripes", "percentileBar", "tally", "logo", "nhl"],
} satisfies ExampleMeta;

// The top three of each division qualify for the playoffs; everyone else is grouped below them.
const rows = NHL_STANDINGS.map((r) => ({
  ...r,
  group: r.division_rank <= 3 ? "Top three: a playoff berth" : "Wild-card race and out",
  points_pct: r.points / ((r.wins + r.losses + r.ot_losses) * 2),
}));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.rank("division_rank", { label: "" }),
    c.logo("team", { league: "nhl", includeName: true, label: "Team" }),
    c.tally(["wins", "losses", "ot_losses"], { label: "W-L-OT" }),
    c.int("points", { label: "Pts" }),
    c.percentileBar("points_pct", { label: "Points %", domain: [0, 100], decimals: 1 }),
  ])
  .groupBy("group")
  .groupStripes({ color: "#EEF3FA", start: 1 })
  .titleHeader("Atlantic Division", { kicker: "NHL 2025-26", subtitle: "Final regular-season standings" })
  .sourceNote("Source: NHL api-web /v1/standings/now")
  .theme("swiss")
  .build();
export default await renderHTMLAsync(spec, rows);
