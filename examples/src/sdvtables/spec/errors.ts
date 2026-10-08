import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { SdvplotError } from "@sportsdataverse/sdvplot";
import { TableSpecError, defineTable } from "@sportsdataverse/sdvtables";
import { renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Errors: one TableSpecError, raised early",
  tags: ["table", "errors", "TableSpecError", "SdvplotError"],
} satisfies ExampleMeta;

const caught = (f: () => unknown): string => {
  try {
    f();
    return "no error";
  } catch (e) {
    if (!(e instanceof TableSpecError && e instanceof SdvplotError)) throw e;
    return `${e.name}: ${e.message}`;
  }
};
const t = defineTable<Standing>();
const wins = t.columns((c) => [c.int("wins")]);
// Rows read from a file are untyped; here a CSV that lost its net_epa column.
const csv: Record<string, unknown>[] = STANDINGS.map(({ net_epa: _dropped, ...rest }) => rest);
const loose = defineTable<Record<string, unknown>>();

export default {
  "build() with no columns": caught(() => t.build()),
  "the same key twice": caught(() => t.columns((c) => [c.int("wins"), c.int("wins")]).build()),
  "two titles": caught(() => wins.title("a").title("b").build()),
  "an unknown theme": caught(() => renderHTML(wins.theme("neon").build(), STANDINGS)),
  "sdvTeam without a league": caught(() => renderHTML(wins.theme("sdvTeam").build(), STANDINGS)),
  "a column the rows lack": caught(() =>
    renderHTML(loose.columns((c) => [c.text("team"), c.text("net_epa")]).build(), csv),
  ),
};
