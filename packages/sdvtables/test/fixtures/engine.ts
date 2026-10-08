import { defineTable } from "../../src/define.js";
import type { TableSpec } from "../../src/spec.js";
import { NFL_2024 } from "./nfl-2024.js";
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

/** Real rows for pagination: all 32 teams of the 2024 NFL regular season, A to Z (see nfl-2024.ts). */
export const many: readonly Row[] = NFL_2024;
