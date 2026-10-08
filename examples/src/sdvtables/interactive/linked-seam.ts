import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Driving a table from outside: rowKey, setSelection, setExternalFilter, subscribe",
  tags: ["table", "interactive", "linked", "createTable", "nfl"],
} satisfies ExampleMeta;

// .rowKey("team"): a row's id is its team, so a figure (or a URL) can name rows without knowing their order
const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.text("division"), c.int("wins"), c.num("net_epa", { digits: 3 })])
  .title("AFC, 2024")
  .rowKey("team")
  .build();
const table = createTable(spec, STANDINGS, { sort: { col: "wins", dir: "desc" } });
const events: string[] = [];
const stop = table.subscribe((e) => events.push(e.type));
table.setSelection(new Set(["KC", "BUF"])); // a chart's brush picked the two division winners
table.setExternalFilter((r) => r.wins >= 10); // another view keeps the playoff-record teams; ANDed with the table's own
table.setSelection(new Set(["KC", "BUF"])); // the same selection again notifies nobody, so a two-way link cannot loop
stop();
export default `${renderHTML(table)}<p>events: ${events.join(", ")}; selected: ${[...table.getSelection()].join(", ")}</p>`;
