import type { Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { columnLabel, leaguesOf } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "leaguesOf and columnLabel: what a spec needs and shows",
  tags: ["table", "leaguesOf", "columnLabel", "prepare"],
} satisfies ExampleMeta;

// leaguesOf lists the league shards prepare() will load: team-aware columns and the sdvTeam theme.
// ESPN headshot URLs are built from the id alone, so a headshot column needs none.
const teams = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("wins"),
    c.num("net_epa", { label: "Net EPA/play" }),
  ])
  .build();
const players = defineTable<Standing>()
  .columns((c) => [c.headshot("qb_espn_id", { league: "nfl" }), c.text("qb")])
  .build();

export default {
  "leaguesOf(teams)": leaguesOf(teams),
  "leaguesOf(players)": leaguesOf(players),
  // a label falls back to the key, title-cased
  "teams.columns.map(columnLabel)": teams.columns.map(columnLabel),
  "players.columns.map(columnLabel)": players.columns.map(columnLabel),
};
