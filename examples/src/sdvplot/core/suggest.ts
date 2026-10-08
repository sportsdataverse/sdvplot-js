import { suggest } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Candidates for a misspelt team",
  tags: ["suggest", "resolve", "nfl"],
} satisfies ExampleMeta;

// [team_id, name] pairs, best first. suggest never picks one for you.
export default await suggest("Kansas Cty", "nfl");
