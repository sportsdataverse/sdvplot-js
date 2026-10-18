import { defineTable } from "@sportsdataverse/sdvtables";
import { ICON_NAMES, renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "iconSet: every icon, picked per row with iconRef",
  tags: ["formatter", "iconSet", "icon_sets", "reactablefmtr", "ICON_NAMES"],
} satisfies ExampleMeta;

// ICON_NAMES lists the inline-SVG icons iconSet and iconAssign draw. iconRef reads each row's icon from a column, and
// iconPosition "over" shows the icon alone.
const icons = ICON_NAMES.map((name, i) => ({ name, i }));
const spec = defineTable<(typeof icons)[number]>()
  .columns((c) => [
    c.text("name", { label: "Name" }),
    c.iconSet("i", {
      label: "Icon",
      iconRef: "name",
      iconPosition: "over",
      colors: ["#15607A"],
      iconSize: 20,
    }),
  ])
  .build();
export default await renderHTMLAsync(spec, icons);
