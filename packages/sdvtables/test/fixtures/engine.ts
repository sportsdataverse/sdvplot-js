import { defineTable } from "../../src/define.js";
import type { TableSpec } from "../../src/spec.js";
import { STANDINGS, type Standing } from "./standings.js";

export type Row = Standing;
export const rows: readonly Row[] = STANDINGS;

export const spec: TableSpec<Row> = defineTable<Row>()
  .columns((c) => [
    c.text("team", { filterable: true }),
    c.int("wins"),
    c.num("net_epa", { digits: 3 }),
    c.text("qb", { label: "Quarterback", sortable: false }),
  ])
  .theme("sdv", { density: "compact" })
  .build();

/** 25 rows for pagination: team "T01".."T25", wins 1..25, the rest cycled from STANDINGS. */
export const many: readonly Row[] = Array.from({ length: 25 }, (_, i) => {
  const base = STANDINGS[i % STANDINGS.length] as Standing;
  return { ...base, team: `T${String(i + 1).padStart(2, "0")}`, wins: i + 1 };
});
