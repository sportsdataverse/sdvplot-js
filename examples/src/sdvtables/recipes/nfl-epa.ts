import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "NFL EPA per play: all 32 teams, paged and sortable, with colour pills, a delta and a legend",
  tags: [
    "table",
    "recipe",
    "interactive",
    "logo",
    "wordmark",
    "colorPills",
    "delta",
    "legendContinuous",
    "nfl",
  ],
} satisfies ExampleMeta;

// EPA per play from the season totals. A defence's EPA allowed is flipped in sign (EPA saved), so higher is better in
// both pill columns and one legend reads for both; net = offence minus EPA allowed.
const rows = NFL_TEAM_EPA_2024.map((r) => ({
  logo: r.team,
  team: r.team,
  off: r.off_epa / r.off_plays,
  saved: -r.def_epa / r.def_plays,
  // delta(from, to) shows to - from under the key `from`, so the net column reads EPA allowed under its own key
  net: r.def_epa / r.def_plays,
}));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.logo("logo", { league: "nfl", label: "", sortable: false }),
    c.wordmark("team", { league: "nfl", label: "Team", filterable: true }),
    c.colorPills("off", { label: "Offence", digits: 3, domain: [-0.25, 0.25] }),
    c.colorPills("saved", { label: "Defence", digits: 3, domain: [-0.25, 0.25] }),
    c.delta("net", "off", { label: "Net", decimals: 3, arrows: true }),
  ])
  .legendContinuous({ title: "EPA per play", digits: 2 })
  .titleHeader("Who moved the ball, and who stopped it", {
    kicker: "NFL 2024",
    subtitle: "Expected points added per rush or pass play, regular season",
  })
  .sourceNote("Source: nflverse play_by_play_2024")
  .theme("sdv")
  .rowKey("team")
  .build();
await prepare(spec);
// eight teams a page, the best offence first; sort any column, filter by team
const table = createTable(spec, rows, { pageSize: 8, sort: { col: "off", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt") as Element, table);
export default host;
