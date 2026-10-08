import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { SdvTable, useTable } from "@sportsdataverse/sdvtables/react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "useTable: the engine and its snapshot in your own component",
  tags: ["react", "table", "useTable", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.text("division", { filterable: true }), c.int("pf"), c.int("pa")])
  .title("AFC, 2024")
  .rowKey("team")
  .build();

function Standings() {
  // snapshot re-renders this component on every engine change; table drives <SdvTable table={…}/>
  const { table, snapshot } = useTable(spec, STANDINGS, { pageSize: 4, sort: { col: "pf", dir: "desc" } });
  const selected = [...table.getSelection()];
  return (
    <div>
      <p>
        {snapshot.filteredCount} of {STANDINGS.length} teams, page {snapshot.state.page + 1} of{" "}
        {snapshot.pageCount}
        {selected.length > 0 ? `; selected: ${selected.join(", ")}` : ""}
      </p>
      <SdvTable table={table} interactive />
    </div>
  );
}
export default <Standings />;
