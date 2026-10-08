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

/**
 * LV's 2024 row with Aidan O'Connell at quarterback: a real name with an apostrophe, for the escaping tests. He started
 * 7 of LV's 17 games (weeks 6-8 and 15-18, nflverse games.csv; Gardner Minshew started the other 10, so STANDINGS
 * lists Minshew); 4260394 is his ESPN id in nflverse players.csv (fixtures/examples/nfl_qb_espn_ids_2024.csv).
 */
export const LV_OCONNELL: Row = { ...(STANDINGS[3] as Row), qb: "Aidan O'Connell", qb_espn_id: "4260394" };

/** Real rows for pagination: all 32 teams of the 2024 NFL regular season, A to Z (see nfl-2024.ts). */
export const many: readonly Row[] = NFL_2024;
