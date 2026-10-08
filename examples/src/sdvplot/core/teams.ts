import { teams } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Every team in a league",
  tags: ["teams", "nhl"],
} satisfies ExampleMeta;

const nhl = await teams("nhl");
export default nhl.map((t) => `${t.team_id}  ${t.abbr ?? "-"}  ${t.name ?? ""}`);
