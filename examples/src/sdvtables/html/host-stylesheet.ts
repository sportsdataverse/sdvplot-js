import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML, styleSheet, themeKey } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Many tables, one stylesheet",
  tags: ["table", "styleSheet", "themeKey", "css", "renderHTML", "nfl"],
} satisfies ExampleMeta;

const division = (name: string) =>
  defineTable<Standing>()
    .columns((c) => [c.logo("team", { league: "nfl", includeName: true }), c.int("wins"), c.int("losses")])
    .theme("athletic")
    .title(`AFC ${name}, 2024`)
    .build();
const west = division("West");
const east = division("East");
await prepare(west);

// Same theme, density and options, so the same themeKey class: the host page writes styleSheet() once per key
// and renders each table with css: "none".
const key = themeKey(west.theme);
export default [
  `<style>${styleSheet(west)}</style>`,
  `<p>Both tables carry the class <code>${key}</code> (east: <code>${themeKey(east.theme)}</code>).</p>`,
  renderHTML(
    west,
    STANDINGS.filter((r) => r.division === "West"),
    { css: "none" },
  ),
  renderHTML(
    east,
    STANDINGS.filter((r) => r.division === "East"),
    { css: "none" },
  ),
].join("\n");
