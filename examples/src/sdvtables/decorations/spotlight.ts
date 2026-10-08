import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "spotlight: one row lit, the rest dimmed",
  tags: ["decoration", "spotlight", "gt_spotlight", "predicate"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("qb"), c.int("wins"), c.int("losses")])
  .spotlight({ key: "team", op: "==", value: "BUF" }, { fill: "#E8EEF9", accentColor: "#00338D" })
  .title("AFC, 2024: Buffalo")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
