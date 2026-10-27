import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "TanStack Table v9 in Svelte 5 on the dark midnight theme: the 2023-24 Pacific Division, logos by stats.nba.com team id",
  tags: ["svelte", "table", "tanstack-table", "tanstackTable", "logo", "midnight", "dark mode", "nba"],
} satisfies ExampleMeta;

// the five Pacific rows, keyed by stats.nba.com's numeric TeamID: the logos resolve from the number
const rows = NBA_STANDINGS.map((s) => ({
  team_id: s.team_id,
  name: `${s.city} ${s.team}`,
  wins: s.wins,
  losses: s.losses,
  win_pct: s.wins / (s.wins + s.losses),
  division_rank: s.division_rank,
}));
type Row = (typeof rows)[number];
const spec = defineTable<Row>()
  .columns((c) => [
    c.rank("division_rank", { label: "Rank" }),
    c.logo("team_id", { league: "nba", label: "", height: 32, sortable: false }),
    c.text("name", { label: "Team" }),
    c.int("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
    c.pct("win_pct", { label: "Win %", digits: 1, scale: true }),
  ])
  .theme("midnight")
  .rowKey("team_id")
  .build();
await prepare(spec);

// In the browser: examples/snippets/svelte/TanstackStandings.svelte, mounted with these props (Svelte's mount()). It
// builds the table with tanstackTable and @tanstack/svelte-table's createTable; click a header to sort.
export const browser = {
  lib: "svelte",
  component: "TanstackStandings",
  props: { spec, rows, sorting: [{ id: "win_pct", desc: true }] },
  label:
    "The 2023-24 Pacific Division as a sortable TanStack Table on a dark background, each team's logo by its stats.nba.com id",
} as const;

// Svelte draws only in a browser here; without JavaScript the page shows the same table as sdvtables' HTML
export default renderHTML(spec, rows);
