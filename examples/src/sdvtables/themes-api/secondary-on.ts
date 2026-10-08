import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, onColor, teamColorsSync } from "@sportsdataverse/sdvplot";
import { defineTable, secondaryOn } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "sdvTeam and secondaryOn: a header in the team colour",
  tags: ["theme", "sdvTeam", "secondaryOn", "nfl"],
} satisfies ExampleMeta;

// sdvTeam fills the header with the team's primary colour. The title takes onColor(primary); the subtitle takes
// secondaryOn(primary, title ink): the title ink blended toward the fill as far as it still reads at 4.5:1.
await loadLeague("nfl");
const rows = STANDINGS.map((r) => {
  const primary = teamColorsSync("nfl", r.team) ?? "#0B1A33";
  const title = onColor(primary);
  return { team: r.team, primary, title_ink: title, subtitle_ink: secondaryOn(primary, title) };
});
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.teamColorBar("team", { league: "nfl", barWidth: 8 }),
    c.text("primary"),
    c.text("title_ink"),
    c.text("subtitle_ink"),
  ])
  .theme("sdvTeam", { options: { league: "nfl", team: "KC" } })
  .title("Kansas City, sdvTeam")
  .subtitle("Each row: the header inks sdvTeam would pick for that team")
  .build();
export default await renderHTMLAsync(spec, rows);
