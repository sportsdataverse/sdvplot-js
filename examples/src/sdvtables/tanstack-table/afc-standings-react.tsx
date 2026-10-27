import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { fontsLinkFor, prepare } from "@sportsdataverse/sdvtables/html";
import { tanstackTable } from "@sportsdataverse/sdvtables/tanstack-table";
import { useEffect } from "react";
import { SdvTable, features, renderPart } from "../../../snippets/tanstack-table/SdvTable.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "TanStack Table v9 in React: the 2024 AFC East and West, sortable, with team logos",
  tags: ["react", "table", "tanstack-table", "tanstackTable", "logo", "nfl"],
} satisfies ExampleMeta;

// the eight AFC East and West teams of the sample standings; New England's net EPA is blank, so it sorts last both ways
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl", label: "Team", includeName: true, height: 28 }),
    c.text("division"),
    c.int("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
    c.num("net_epa", { label: "Net EPA/play", digits: 3, forceSign: true }),
    c.rank("srs_rank", { label: "SRS rank" }),
  ])
  .theme("sdv")
  .rowKey("team")
  .build();
await prepare(spec);
// TanStack Table's options for useTable, built once (module scope): the columns, the rows and their ids by team
const sdv = tanstackTable(spec, STANDINGS, { features, render: renderPart });

function Standings() {
  // the theme's fonts: the page <head> carries the link fontsLinkFor returns
  useEffect(() => document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)), []);
  // sorted by wins to start; click a header to sort by it
  return <SdvTable spec={spec} sdv={sdv} sorting={[{ id: "wins", desc: true }]} />;
}
export default <Standings />;
