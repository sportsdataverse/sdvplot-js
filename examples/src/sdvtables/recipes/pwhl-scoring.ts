import { PWHL_GOALS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "PWHL scoring summary: logos, scorers in team colour, a running score and a cutline per period",
  tags: [
    "table",
    "recipe",
    "scoring summary",
    "mergeStackTeamColor",
    "logo",
    "cutline",
    "hockeytech",
    "pwhl",
  ],
} satisfies ExampleMeta;

// The feed's abbreviations as HockeyTech team ids (what sdvplot's pwhl data keys on), and as 2024 team names.
const HOCKEYTECH_ID = { BOS: "1", MTL: "3" } as const;
const NAME_2024 = { BOS: "PWHL Boston", MTL: "PWHL Montreal" } as const;
// the running score after each goal, from the goals themselves (Boston away, Montreal at home)
let bos = 0;
let mtl = 0;
const rows = PWHL_GOALS.map((g) => {
  if (g.team === "MTL") mtl++;
  else bos++;
  return {
    period: g.period,
    time: g.time,
    team_id: HOCKEYTECH_ID[g.team],
    team_name: NAME_2024[g.team],
    scorer: g.scorer,
    score: `${bos}-${mtl}`,
  };
});
// a dashed line under the last goal of each period but the last
const ends = rows.flatMap((r, i) => (i < rows.length - 1 && r.period !== rows[i + 1]?.period ? [i + 1] : []));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.int("period", { label: "Per." }),
    c.text("time", { label: "Time" }),
    c.logo("team_id", { league: "pwhl", idSystem: "hockeytech", label: "" }),
    c.mergeStackTeamColor("scorer", "team_name", "team_id", {
      league: "pwhl",
      idSystem: "hockeytech",
      label: "Scored by",
    }),
    c.text("score", { label: "BOS-MTL", align: "center" }),
  ])
  .cutline(ends, { label: ends.map((n) => `End of period ${rows[n - 1]?.period}`), color: "#555555" })
  .titleHeader("Montreal 3, Boston 1", { kicker: "PWHL, 2 March 2024", subtitle: "Every goal, in order" })
  .sourceNote("Source: HockeyTech gameCenterPlayByPlay, game 42")
  .theme("scoreboard")
  .build();
export default await renderHTMLAsync(spec, rows);
