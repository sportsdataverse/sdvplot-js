import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridOptions } from "@sportsdataverse/sdvtables/aggrid";
import { fontsLinkFor, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import { useEffect } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "AG Grid in React on the dark midnight theme: the 2023-24 Pacific Division, logos and row colours by stats.nba.com team id",
  tags: [
    "react",
    "table",
    "ag-grid",
    "ag-grid-react",
    "gridOptions",
    "teamRows",
    "midnight",
    "dark mode",
    "nba",
  ],
} satisfies ExampleMeta;

ModuleRegistry.registerModules([AllCommunityModule]); // AG Grid Community: no enterprise module

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
    c.int("wins", { label: "W", width: "70px" }),
    c.int("losses", { label: "L", width: "70px" }),
    c.pct("win_pct", { label: "Win %", digits: 1, scale: true, width: "90px" }),
  ])
  .theme("midnight")
  .rowKey("team_id")
  .build();
await prepare(spec);
// the midnight theme as AG Grid theme params over Quartz; every row in its team's dark-mode colour at 30%
const options = gridOptions(spec, rows, {
  theme: themeQuartz,
  teamRows: { key: "team_id", league: "nba", alpha: 0.3 },
});

// the drawer passes onGridReady, to hand the grid to the render test
function Pacific(props: Pick<AgGridReactProps<Row>, "onGridReady">) {
  useEffect(() => document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)), []);
  return <AgGridReact<Row> {...options} {...props} domLayout="autoHeight" />;
}

export const browser = {
  lib: "ag-grid-react",
  grid: () => <Pacific />,
  width: 600,
  label:
    "The 2023-24 Pacific Division as an AG Grid on a dark background, each row in its team's colour with its logo, ranked by division",
} as const;

// AG Grid draws only in a browser; without JavaScript the page shows the same table as sdvtables' HTML
export default renderHTML(spec, rows);
