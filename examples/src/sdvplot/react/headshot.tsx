import { STANDINGS } from "@sportsdataverse/examples/data";
import { Headshot } from "@sportsdataverse/sdvplot/react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "<Headshot/> for every AFC starting quarterback",
  tags: ["react", "Headshot", "nfl"],
} satisfies ExampleMeta;

// ESPN ids render on the first pass; idSystem="gsis" renders once the gsis map has loaded.
export default (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {STANDINGS.map((s) => (
      <Headshot key={s.qb_espn_id} playerId={s.qb_espn_id} league="nfl" height={60} alt={s.qb} title={s.qb} />
    ))}
  </div>
);
