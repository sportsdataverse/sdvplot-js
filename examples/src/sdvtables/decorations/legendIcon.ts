import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "legendIcon: reactablefmtr's icon legend, drawn as inline SVG",
  tags: ["decoration", "legendIcon", "add_icon_legend", "reactablefmtr"],
} satisfies ExampleMeta;

// Each team's win share falls in one of reactablefmtr's "batteries" bands; the legend under the table keys them.
const BANDS = ["0-25%", "25-50%", "50-75%", "75-100%"] as const;
const rows = STANDINGS.map((r) => {
  const share = r.wins / (r.wins + r.losses + r.ties);
  return {
    team: r.team,
    wins: r.wins,
    losses: r.losses,
    share,
    band: BANDS[Math.min(3, Math.floor(share * 4))],
  };
});
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("wins"),
    c.int("losses"),
    c.pct("share", { label: "Win share" }),
    c.text("band", { label: "Band" }),
  ])
  .legendIcon({ iconSet: "batteries", title: "Win-share band", footer: "Ties count as games played" })
  .title("AFC, 2024 regular season")
  .build();
export default await renderHTMLAsync(spec, rows);
