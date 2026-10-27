import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridOptions } from "@sportsdataverse/sdvtables/aggrid";
import { fontsLinkFor, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "AG Grid (plain JavaScript): the 2024 AFC East and West, each row in its team's colour with its logo, sorted by wins",
  tags: ["table", "ag-grid", "gridOptions", "teamRows", "logo", "nfl"],
} satisfies ExampleMeta;

// the eight AFC East and West teams, picked by id from the 2024 standings
const spec = defineTable<(typeof STANDINGS)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true, label: "Team", height: 24, width: "110px" }),
    c.text("division", { width: "90px" }),
    c.int("wins", { label: "W", width: "60px" }),
    c.int("losses", { label: "L", width: "60px" }),
    c.int("pf", { label: "PF", width: "70px" }),
    c.int("pa", { label: "PA", width: "70px" }),
    c.num("net_epa", { label: "Net EPA/play", digits: 3, forceSign: true, width: "120px" }),
  ])
  .theme("sdv")
  .rowKey("team")
  .build();
await prepare(spec); // the NFL logos and colours; gridOptions itself is synchronous

// In the browser this page calls mount with ag-grid-community's module and the grid's element.
export const browser = {
  lib: "ag-grid",
  mount: (
    { AllCommunityModule, ModuleRegistry, createGrid, themeQuartz }: typeof import("ag-grid-community"),
    el: HTMLElement,
  ) => {
    ModuleRegistry.registerModules([AllCommunityModule]); // AG Grid Community: no enterprise module
    document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)); // the sdv theme's fonts
    return createGrid(el, {
      ...gridOptions(spec, STANDINGS, {
        theme: themeQuartz,
        teamRows: { key: "team", league: "nfl" },
      }),
      domLayout: "autoHeight",
      initialState: { sort: { sortModel: [{ colId: "wins", sort: "desc" }] } },
    });
  },
  width: 600,
  label:
    "The 2024 AFC East and West standings as an AG Grid, one row per team in its team colour with its logo, sorted by wins",
} as const;

// AG Grid draws only in a browser; without JavaScript the page shows the same table as sdvtables' HTML
export default renderHTML(spec, STANDINGS);
