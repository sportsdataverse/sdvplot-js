import { STANDINGS } from "@sportsdataverse/examples/data";
import { rowsFrom } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Columns to rows",
  tags: ["rowsFrom", "data"],
} satisfies ExampleMeta;

// Column-shaped data (an R or pandas habit) to the row objects Plot and the marks take.
export default rowsFrom({
  team: STANDINGS.map((s) => s.team),
  wins: STANDINGS.map((s) => s.wins),
  losses: STANDINGS.map((s) => s.losses),
});
