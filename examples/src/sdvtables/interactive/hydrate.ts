import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "hydrate: sort, filter, page and select without React",
  tags: ["table", "interactive", "createTable", "hydrate", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true }),
    c.text("division", { filterable: true }),
    c.int("wins"),
    c.int("losses"),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
  ])
  .title("AFC")
  .subtitle("2024 regular season")
  .rowKey("team")
  .build();
await prepare(spec);
const table = createTable(spec, STANDINGS, { pageSize: 4, sort: { col: "wins", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table); // the same string a server or a static site would send
// one delegated listener set; each change re-renders only the table block and the pager
hydrate(host.querySelector(".sdvt") as Element, table);
export default host;
