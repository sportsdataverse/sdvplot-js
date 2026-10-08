import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import {
  handleClick,
  handleHover,
  handleInput,
  pagerLabel,
  renderInteractive,
  renderParts,
  rowIdAt,
  tableHTML,
  tableRenderOptions,
} from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Your own wiring: the handlers hydrate and <SdvTable/> share",
  tags: ["table", "interactive", "handleClick", "handleInput", "handleHover", "rowIdAt", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.text("qb", { label: "Quarterback" }), c.int("wins"), c.int("losses")])
  .title("AFC, 2024")
  .rowKey("team")
  .build();
const table = createTable(spec, STANDINGS, { pageSize: 4 });

const el = document.createElement("div");
el.innerHTML = renderInteractive(table); // what renderHTML(table) returns: toolbar, table block, pager
const status = document.createElement("p");
el.append(status);
// The same three handlers hydrate attaches: each reads the event target and calls the engine.
el.addEventListener("click", (e) => {
  const id = rowIdAt(table, e.target); // the row id under the click, or null off the body rows
  if (id !== null) status.textContent = `Clicked ${id}`;
  handleClick(table, e.target); // a sort button sorts, a pager button pages, a row toggles its selection
});
el.addEventListener("input", (e) => handleInput(table, e.target)); // the search and filter boxes
el.addEventListener("mouseover", (e) => handleHover(table, e.target)); // the engine's hover event
// Re-render the table block and the pager label only, so the search box keeps its focus while you type.
const body = el.querySelector("[data-sdv-body]") as Element;
const label = el.querySelector("[data-sdv-page-label]") as Element;
table.subscribe((e) => {
  if (e.type === "hover") return;
  body.innerHTML = tableHTML(renderParts(spec, table.rows, { css: "none", ...tableRenderOptions(table) }));
  label.textContent = pagerLabel(table);
});
export default el;
