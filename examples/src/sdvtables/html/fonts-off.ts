import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable, resolveTheme } from "@sportsdataverse/sdvtables";
import { fontsLink, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "fonts: false, and loading the fonts yourself",
  tags: ["table", "renderHTML", "fonts", "fontsLink", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl", includeName: true }), c.int("wins"), c.int("losses")])
  .theme("athletic")
  .title("AFC, 2024")
  .build();
await prepare(spec);
// Every table starts with a Google Fonts <link> for its theme. fonts: false leaves it out; the page loads them
// once instead, e.g. with this <link> in its <head>:
const head = fontsLink(resolveTheme(spec.theme).fonts);
const escaped = head.replace(/&/g, "&amp;").replace(/</g, "&lt;");
export default `<p><code>${escaped}</code></p>\n${renderHTML(spec, STANDINGS, { fonts: false })}`;
