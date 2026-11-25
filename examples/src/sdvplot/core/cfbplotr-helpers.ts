import {
  aliases,
  cleanNamesSync,
  loadLeague,
  palette,
  teamFactorSync,
  teams,
} from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "cfbplotR's helpers: clean names, divisions, team order and alternate colours",
  tags: ["cleanNames", "teams", "teamFactor", "aliases", "palette", "cfb"],
} satisfies ExampleMeta;

await loadLeague("cfb");
const schools = ["utah", "San Jose State", "Hawaii", "UTSA", "BYU"];

export default {
  cleaned: cleanNamesSync(schools, "cfb"),
  abbreviations: cleanNamesSync(schools, "cfb", { column: "abbr" }),
  "P4 schools": (await teams("cfb", { division: "P4" })).length,
  "team order": teamFactorSync(schools, "cfb").levels,
  "names the index knows for Utah": (await aliases("cfb"))
    .filter((a) => a.team_id === "254" && a.id_system === "name")
    .map((a) => a.value),
  "Utah in its other colour": await palette("cfb", ["Utah", "BYU"], { altColors: "Utah" }),
};
