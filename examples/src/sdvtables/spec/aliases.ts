import { GT_ALIASES, aliasFor, defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Every sdvplotR / gtUtils name and its sdvtables home",
  tags: ["table", "GT_ALIASES", "aliasFor", "migration", "sdvplotR", "gtUtils"],
} satisfies ExampleMeta;

// c.<kind> is a column kind, builder.<method> a decoration, theme.<name> a theme, html.<name> the ./html subpath.
const rows = Object.entries(GT_ALIASES).map(([name, a]) => ({
  name,
  target: a.target,
  status: a.status,
  note: a.note ?? "",
}));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.text("name", { label: "sdvplotR / gtUtils" }),
    c.text("target", { label: "sdvtables" }),
    c.highlight("status", { key: "status", op: "!=", value: "ported" }),
    c.text("note"),
  ])
  .title("GT_ALIASES")
  .subtitle(
    `${rows.length} names; aliasFor("gt_color_pills").target is "${aliasFor("gt_color_pills")?.target}"`,
  )
  .build();
export default await renderHTMLAsync(spec, rows);
