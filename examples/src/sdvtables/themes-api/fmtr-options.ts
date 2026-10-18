import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "reactablefmtr theme options: fmtr-nytimes as shipped, then striped with larger type",
  tags: ["theme", "fmtr", "fmtr-nytimes", "nytimes", "reactablefmtr", "options", "nfl"],
} satisfies ExampleMeta;

// A reactablefmtr theme function's arguments are the theme's options; reactable's striped and highlight are too.
const variants = [
  { label: "as shipped", options: {} },
  { label: 'striped: "true", fontSize: "14"', options: { striped: "true", fontSize: "14" } },
];
const tables = await Promise.all(
  variants.map(({ label, options }) =>
    renderHTMLAsync(
      defineTable<Standing>()
        .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
        .theme("fmtr-nytimes", { options })
        .title(`fmtr-nytimes, ${label}`)
        .build(),
      STANDINGS.slice(0, 4),
    ),
  ),
);
export default tables.join("\n");
