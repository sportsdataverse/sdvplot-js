import type { Standing } from "@sportsdataverse/examples/data";
import { RANK_PALETTE, TableBuilder, columnFactory, defineTable } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The column factory and the immutable builder",
  tags: ["table", "columnFactory", "TableBuilder", "RANK_PALETTE"],
} satisfies ExampleMeta;

// .columns((c) => [...]) hands you this factory; each c.* call returns a column spec with the sdvplotR defaults.
const c = columnFactory<Standing>();
const base = defineTable<Standing>();
const titled = base.title("AFC, 2024");

export default {
  'c.rank("srs_rank")': c.rank("srs_rank"),
  'c.delta("pa", "pf")': c.delta("pa", "pf"),
  'c.colorRanks("pf").palette is RANK_PALETTE': c.colorRanks("pf").palette === RANK_PALETTE,
  RANK_PALETTE,
  "c.fmtRank is c.rank (the gtUtils name)": c.fmtRank === c.rank,
  "defineTable() is a TableBuilder": base instanceof TableBuilder,
  "every method returns a new builder": titled !== base,
};
