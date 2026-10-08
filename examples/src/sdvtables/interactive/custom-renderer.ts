import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import {
  assemble,
  attrsText,
  hydrate,
  renderPager,
  renderParts,
  renderToolbar,
  sortAria,
  tableHTML,
  tableRenderOptions,
} from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A custom renderer: the pager above the table, the search box below",
  tags: ["table", "interactive", "renderParts", "assemble", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.text("division"),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
  ])
  .title("AFC, 2024")
  .theme("swiss")
  .rowKey("team")
  .build();
const table = createTable(spec, STANDINGS, { pageSize: 4, sort: { col: "pf", dir: "desc" } });

// renderParts gives the pieces renderHTML(table) joins; tableRenderOptions carries the engine's sort, selection, page
const p = renderParts(spec, table.rows, tableRenderOptions(table));
const inner = `${renderPager(table)}<div class="sdvt-body" data-sdv-body="">${tableHTML(p)}</div>${renderToolbar(table, p.labels)}`;
// a card around the wrapper; attrsText escapes the values, as assemble does for the wrapper's own attributes
const card = `<section${attrsText({ class: "standings-card", "data-pf-sort": sortAria(table.state.sort, "pf") })}>${assemble(p, inner)}</section>`;

const host = document.createElement("div");
host.innerHTML = card;
hydrate(host.querySelector(".sdvt") as Element, table); // hydrate finds the block, pager and inputs wherever they sit
export default host;
