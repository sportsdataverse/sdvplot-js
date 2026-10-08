import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "teamColorBg: a cell tinted with the team colour",
  tags: ["kind", "teamColorBg", "reactable_sdv_team_color_bg", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.teamColorBg("team", { league: "nfl", which: "secondary", alpha: 0.5 }),
    c.text("qb"),
    c.int("wins"),
  ])
  .title("AFC, 2024: secondary colours at 50%")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
