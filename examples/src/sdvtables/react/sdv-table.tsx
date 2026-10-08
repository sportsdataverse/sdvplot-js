import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { fontsLinkFor, prepare } from "@sportsdataverse/sdvtables/html";
import { SdvTable } from "@sportsdataverse/sdvtables/react";
import { useEffect } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "<SdvTable/>: the static table, and the same spec interactive",
  tags: ["react", "table", "SdvTable", "fontsLinkFor", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true }),
    c.text("division", { filterable: true }),
    c.int("wins"),
    c.int("losses"),
  ])
  .title("AFC, 2024")
  .rowKey("team")
  .build();
await prepare(spec); // before the first render, on the server too

function Standings() {
  // <SdvTable/> writes no fonts <link>: the page <head> carries the one fontsLinkFor returns (a server puts it there)
  useEffect(() => document.head.insertAdjacentHTML("beforeend", fontsLinkFor(spec)), []);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <SdvTable spec={spec} rows={STANDINGS.filter((r) => r.division === "West")} />
      <SdvTable spec={spec} rows={STANDINGS} interactive pageSize={4} sort={{ col: "wins", dir: "desc" }} />
    </div>
  );
}
export default <Standings />;
