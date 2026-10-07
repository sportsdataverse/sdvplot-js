import { expectTypeOf, test } from "vitest";
import { defineTable } from "../src/define.js";
import type { ColumnSpec, TableSpec } from "../src/spec.js";
import type { Standing } from "./fixtures/standings.js";
test("accessors are keyof Row and numeric kinds accept only numeric keys", () => {
  defineTable<Standing>().columns((c) => [
    c.num("wins"),
    // @ts-expect-error — "qb" is a string column
    c.num("qb"),
    // @ts-expect-error — not a key of Standing
    c.text("nope"),
    c.delta("pf", "pa"),
    c.tally(["wins", "losses", "ties"]),
  ]);
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .build();
  expectTypeOf(spec).toEqualTypeOf<TableSpec<Standing>>();
  expectTypeOf<ColumnSpec<Standing>["kind"]>().toEqualTypeOf<
    | "text"
    | "num"
    | "int"
    | "pct"
    | "rank"
    | "delta"
    | "tally"
    | "logo"
    | "wordmark"
    | "headshot"
    | "colorPills"
    | "colorRanks"
    | "colorResults"
    | "percentileBar"
    | "indicatorBox"
    | "highlight"
    | "highlightNa"
    | "mergeStackTeamColor"
    | "teamColorBar"
    | "teamColorBg"
    | "image"
  >();
  // headshots take only the eight ESPN headshot leagues (sdvplot EspnHeadshotLeague)
  // @ts-expect-error — no ESPN headshots for the PWHL
  defineTable<Standing>().columns((c) => [c.headshot("qb_espn_id", { league: "pwhl" })]);
});
