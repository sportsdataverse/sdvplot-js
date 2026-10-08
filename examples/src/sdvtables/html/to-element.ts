import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, toElement } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "toElement: a table as a DOM element",
  tags: ["table", "toElement", "dom", "nfl"],
} satisfies ExampleMeta;

// toElement needs a DOM (a browser, jsdom or happy-dom); it moves the theme's font <link> into <head> once.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("qb"), c.int("wins"), c.int("losses")])
  .theme("pl")
  .title("AFC, 2024")
  .build();
await prepare(spec);
export default toElement(spec, STANDINGS);
