import { NHL_STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridOptions } from "@sportsdataverse/sdvtables/aggrid";
import { fontsLinkFor, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "AG Grid on the striped savant theme: the 2025-26 NHL Atlantic Division, team-coloured rows over the stripes, rows selectable",
  tags: ["table", "ag-grid", "gridOptions", "teamRows", "logo", "savant", "nhl"],
} satisfies ExampleMeta;

// the eight Atlantic rows, picked by team from the final 2025-26 standings
const spec = defineTable<(typeof NHL_STANDINGS)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nhl", includeName: true, label: "Team", height: 24, width: "110px" }),
    c.int("wins", { label: "W", width: "70px" }),
    c.int("losses", { label: "L", width: "70px" }),
    c.int("ot_losses", { label: "OTL", width: "70px" }),
    c.int("points", { label: "Pts", width: "70px" }),
  ])
  .theme("savant") // striped: odd rows are #F4F4F4, which a team row's own fill covers
  .rowKey("team")
  .build();
await prepare(spec);

// In the browser this page calls mount with ag-grid-community's module and the grid's element.
export const browser = {
  lib: "ag-grid",
  mount: (
    { AllCommunityModule, ModuleRegistry, createGrid, themeQuartz }: typeof import("ag-grid-community"),
    el: HTMLElement,
  ) => {
    ModuleRegistry.registerModules([AllCommunityModule]); // AG Grid Community: no enterprise module
    document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)); // the savant theme's fonts
    return createGrid(el, {
      ...gridOptions(spec, NHL_STANDINGS, {
        theme: themeQuartz,
        teamRows: { key: "team", league: "nhl" },
      }),
      domLayout: "autoHeight",
      // click a row to select it (AG Grid Community's row selection): it keeps a shade of its team's colour
      rowSelection: { mode: "singleRow", checkboxes: false, enableClickSelection: true },
    });
  },
  width: 480,
  label:
    "The 2025-26 NHL Atlantic Division standings as an AG Grid on the striped savant theme, one row per team in its team colour with its logo",
} as const;

// AG Grid draws only in a browser; without JavaScript the page shows the same table as sdvtables' HTML
export default renderHTML(spec, NHL_STANDINGS);
