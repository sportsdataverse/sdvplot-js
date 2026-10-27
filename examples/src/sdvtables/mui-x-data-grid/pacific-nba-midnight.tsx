import { DataGrid } from "@mui/x-data-grid";
import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { fontsLinkFor, prepare } from "@sportsdataverse/sdvtables/html";
import { dataGridProps } from "@sportsdataverse/sdvtables/mui";
import { useEffect } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "MUI X Data Grid on the dark midnight theme: the 2023-24 Pacific Division, logos by stats.nba.com team id",
  tags: ["react", "table", "mui-x-data-grid", "dataGridProps", "logo", "midnight", "dark mode", "nba"],
} satisfies ExampleMeta;

// the five Pacific rows, keyed by stats.nba.com's numeric TeamID: the logos and row colours resolve from the number
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
    c.rank("division_rank", { label: "Rank", width: "80px" }),
    c.logo("team_id", { league: "nba", label: "", height: 32, sortable: false, width: "64px" }),
    c.text("name", { label: "Team", width: "190px" }),
    c.int("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
    c.pct("win_pct", { label: "Win %", digits: 1, scale: true }),
  ])
  .theme("midnight")
  .rowKey("team_id")
  .build();
await prepare(spec);
const props = dataGridProps(spec, rows, { teamRows: { key: "team_id", league: "nba", alpha: 0.3 } });

function Pacific() {
  useEffect(() => document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)), []);
  return (
    <div style={{ width: "100%", maxWidth: 700, background: "#0C0D10", padding: 12 }}>
      <DataGrid rows={rows} {...props} autoHeight hideFooter disableRowSelectionOnClick />
    </div>
  );
}
export default <Pacific />;
