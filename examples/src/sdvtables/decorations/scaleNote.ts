import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "scaleNote: columns divided, with a note saying so",
  tags: ["decoration", "scaleNote", "gt_scale_note"],
} satisfies ExampleMeta;

// Any divisor works; 1,000 and 1,000,000 come with their own wording ("Figures in thousands.").
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
  ])
  .scaleNote(["pf", "pa"], {
    divisor: 17,
    decimals: 1,
    where: "both",
    note: "Points per game (17 games).",
    labelSuffix: "/ g",
  })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
