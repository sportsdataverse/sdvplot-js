import { nflPlays2024 } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridOptions } from "@sportsdataverse/sdvtables/aggrid";
import { prepare } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "AG Grid with 11,778 rows: every rush and pass of weeks 1 to 6 of the 2024 NFL season, offence logos pinned left, sorted, filtered and scrolled",
  tags: ["table", "ag-grid", "gridOptions", "logo", "play-by-play", "large", "nfl"],
} satisfies ExampleMeta;

// nflverse's 2024 play-by-play, weeks 1 to 6: 11,778 rows, each keyed by its play id
const plays = await nflPlays2024();
const spec = defineTable<(typeof plays)[number]>()
  .columns((c) => [
    c.logo("posteam", { league: "nfl", includeName: true, label: "Offence", height: 20, width: "110px" }),
    c.logo("defteam", { league: "nfl", label: "Defence", height: 20, width: "80px" }),
    c.int("week", { label: "Wk", width: "64px" }),
    c.int("qtr", { label: "Q", width: "56px" }),
    c.text("clock", { label: "Clock", width: "76px" }),
    c.int("down", { label: "Down", width: "72px" }),
    c.int("ydstogo", { label: "To go", width: "76px" }),
    c.int("yardline_100", { label: "Yds to EZ", width: "96px" }),
    c.text("play_type", { label: "Play", width: "80px" }),
    c.int("yards_gained", { label: "Yards", width: "76px" }),
    c.num("epa", { label: "EPA", digits: 2, forceSign: true, width: "80px" }),
    c.pct("wp", { label: "Win prob.", digits: 0, scale: true, width: "96px" }),
  ])
  .theme("sdv", { density: "compact" })
  .rowKey("play")
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
    const options = gridOptions(spec, plays, { theme: themeQuartz });
    return createGrid(el, {
      ...options,
      // the offence stays in view while the other columns scroll; sorted by EPA, high to low
      columnDefs: options.columnDefs.map((d) =>
        d.colId === "posteam"
          ? { ...d, pinned: "left" as const }
          : d.colId === "epa"
            ? { ...d, sort: "desc" as const }
            : d,
      ),
      // every column sorts and filters; only the rows in view are in the page, the others drawn as they scroll in
      defaultColDef: { filter: true },
    });
  },
  width: 720,
  height: 480,
  label:
    "The 11,778 rush and pass plays of weeks 1 to 6 of the 2024 NFL regular season in a scrolling AG Grid, the offence's logo pinned left, sorted by EPA",
} as const;

// AG Grid draws only in a browser; without JavaScript the page shows what the grid holds
export default {
  plays: plays.length,
  games: new Set(plays.map((p) => p.game_id)).size,
  columns: spec.columns.map((c) => c.key),
};
