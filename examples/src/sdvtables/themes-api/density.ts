import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { DENSITY, type Density, defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Density: compact, comfortable, social",
  tags: ["theme", "density", "DENSITY", "nfl"],
} satisfies ExampleMeta;

// .theme(name, { density }) scales type and padding from DENSITY; almanac, scoreboard and terminal default to compact.
const densities: Density[] = ["compact", "comfortable", "social"];
const tables = await Promise.all(
  densities.map((density) =>
    renderHTMLAsync(
      defineTable<Standing>()
        .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
        .theme("sdv", { density })
        .title(`density: "${density}"`)
        .subtitle(`body ${DENSITY[density].body}px, cell padding ${DENSITY[density].pad}px`)
        .build(),
      STANDINGS.slice(0, 3),
    ),
  ),
);
export default tables.join("\n");
