import { STANDINGS } from "@sportsdataverse/examples/data";
import {
  type Comparator,
  NUMERIC_KINDS,
  isMissing,
  nextSortDir,
  withMissingLast,
} from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The engine's sort rules as plain functions",
  tags: ["table", "interactive", "sort", "nextSortDir", "withMissingLast", "nfl"],
} satisfies ExampleMeta;

// New England's net_epa is blank in the sample rows: a missing value, which sorts last in both directions.
const byNumber: Comparator = (a, b) => (a as number) - (b as number);
const order = (dir: "asc" | "desc"): string[] =>
  [...STANDINGS].sort((a, b) => withMissingLast(byNumber, dir)(a.net_epa, b.net_epa)).map((r) => r.team);

export default {
  // a header click cycles ascending, descending, unsorted
  clicks: [
    nextSortDir(null, "net_epa"),
    nextSortDir({ col: "net_epa", dir: "asc" }, "net_epa"),
    nextSortDir({ col: "net_epa", dir: "desc" }, "net_epa"),
  ],
  ascending: order("asc"),
  descending: order("desc"),
  missing: STANDINGS.filter((r) => isMissing(r.net_epa)).map((r) => r.team),
  // the column kinds that sort as numbers (every other kind sorts as text, or by date)
  numericKinds: [...NUMERIC_KINDS],
};
