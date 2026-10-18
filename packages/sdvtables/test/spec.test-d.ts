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
    | "dataBar"
    | "iconSet"
    | "iconAssign"
    | "mergeStack"
    | "bubble"
    | "sparkline"
    | "sparkbar"
    | "gauge"
  >();
  // the in-cell charts take only array-of-number keys (null entries allowed); gauge only numeric ones
  type Weekly = { team: string; wins: number; margins: (number | null)[]; points: readonly number[] | null };
  defineTable<Weekly>().columns((c) => [
    c.sparkline("margins"),
    c.sparkbar("points"),
    c.gauge("wins"),
    // @ts-expect-error — "team" is not a series
    c.sparkline("team"),
    // @ts-expect-error — "wins" is a number, not a series
    c.sparkbar("wins"),
    // @ts-expect-error — a gauge reads a number, not a series
    c.gauge("margins"),
  ]);
  // headshots take only the eight ESPN headshot leagues (sdvplot EspnHeadshotLeague)
  // @ts-expect-error — no ESPN headshots for the PWHL
  defineTable<Standing>().columns((c) => [c.headshot("qb_espn_id", { league: "pwhl" })]);
});
