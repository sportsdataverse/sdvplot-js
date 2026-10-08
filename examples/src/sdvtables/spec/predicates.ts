import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { type Predicate, matches, selectRows } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Predicates: rows picked by data, not by functions",
  tags: ["table", "predicate", "matches", "selectRows"],
} satisfies ExampleMeta;

// highlight, boldRows, spotlight and rowAccent take a Predicate (or row indices): plain data, so a spec stays JSON.
const teams = (p: Predicate<Standing>): string[] =>
  selectRows(p, STANDINGS).map((i) => STANDINGS[i]?.team ?? "");
const [kc] = STANDINGS;

export default {
  "wins >= 11": teams({ key: "wins", op: ">=", value: 11 }),
  'division == "East"': teams({ key: "division", op: "==", value: "East" }),
  "net_epa isNull": teams({ key: "net_epa", op: "isNull" }),
  'team in ["KC", "BUF"]': teams({ key: "team", op: "in", value: ["KC", "BUF"] }),
  'qb matches "^J"': teams({ key: "qb", op: "matches", value: "^J" }),
  "selectRows([0, 4]) (indices pass through)": selectRows([0, 4], STANDINGS),
  "matches(wins > 14, KC)": kc !== undefined && matches({ key: "wins", op: ">", value: 14 }, kc),
};
