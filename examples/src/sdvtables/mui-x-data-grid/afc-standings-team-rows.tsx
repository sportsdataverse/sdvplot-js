import { DataGrid } from "@mui/x-data-grid";
import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { fontsLinkFor, prepare } from "@sportsdataverse/sdvtables/html";
import { dataGridProps } from "@sportsdataverse/sdvtables/mui";
import { useEffect } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "MUI X Data Grid: the 2024 AFC East and West, logos and team-coloured rows",
  tags: ["react", "table", "mui-x-data-grid", "dataGridProps", "logo", "nfl"],
} satisfies ExampleMeta;

// the eight AFC East and West teams of the sample standings, each row filled with its team's colour
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl", label: "Team", includeName: true, height: 28, width: "120px" }),
    c.text("division", { width: "90px" }),
    c.int("wins", { label: "W", width: "56px" }),
    c.int("losses", { label: "L", width: "56px" }),
    c.int("pf", { label: "PF", width: "64px" }),
    c.int("pa", { label: "PA", width: "64px" }),
    c.num("net_epa", { label: "Net EPA/play", digits: 3, forceSign: true, width: "120px" }),
  ])
  .theme("sdv")
  .rowKey("team")
  .build();
await prepare(spec);
const props = dataGridProps(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } });

function Standings() {
  // the theme's fonts: the page <head> carries the link fontsLinkFor returns
  useEffect(() => document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)), []);
  return (
    <div style={{ width: "100%", maxWidth: 820 }}>
      <DataGrid
        rows={STANDINGS}
        {...props}
        autoHeight
        hideFooter
        disableRowSelectionOnClick
        initialState={{ sorting: { sortModel: [{ field: "wins", sort: "desc" }] } }}
      />
    </div>
  );
}
export default <Standings />;
