import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "outliers: values beyond 1.5 IQR flagged",
  tags: ["decoration", "outliers", "gt_outliers"],
} satisfies ExampleMeta;

// Buffalo's 525 points for sits above the upper fence; nothing in points against does.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
  ])
  .outliers(["pf", "pa"], { symbol: "†", note: true })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
