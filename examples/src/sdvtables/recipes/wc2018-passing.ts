import { WC2018_FINAL_FRANCE_PASSES } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "World Cup passing: France's passers in the 2018 final, with percentile bars and pills",
  tags: [
    "table",
    "recipe",
    "interactive",
    "percentileBar",
    "colorPills",
    "rank",
    "soccer",
    "fifa",
    "statsbomb",
  ],
} satisfies ExampleMeta;

// One row per passer (StatsBomb player id): completed passes, their mean length, metres gained toward goal and the
// share that ended in the attacking third (x beyond 70 of the 105 m pitch, France attacking left to right).
const byPlayer = new Map<number, (typeof WC2018_FINAL_FRANCE_PASSES)[number][]>();
for (const p of WC2018_FINAL_FRANCE_PASSES)
  byPlayer.set(p.player_id, [...(byPlayer.get(p.player_id) ?? []), p]);
const rows = [...byPlayer].map(([player_id, passes]) => {
  const n = passes.length;
  return {
    player_id: String(player_id),
    passes: n,
    length: passes.reduce((s, p) => s + Math.hypot(p.end_x - p.start_x, p.end_y - p.start_y), 0) / n,
    gained: passes.reduce((s, p) => s + (p.end_x - p.start_x), 0),
    final_third: passes.filter((p) => p.end_x > 70).length / n,
    order: 0,
  };
});
rows
  .sort((a, b) => b.passes - a.passes)
  .forEach((r, i) => {
    r.order = i + 1;
  });
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.rank("order", { label: "" }),
    c.text("player_id", { label: "Player id", filterable: true }),
    c.int("passes", { label: "Passes" }),
    c.num("length", { label: "Avg length", digits: 1, suffix: " m" }),
    c.colorPills("gained", {
      label: "Metres gained",
      digits: 0,
      palette: ["#B2182B", "#F7F7F7", "#1B7837"],
      domain: [-200, 200],
    }),
    c.percentileBar("final_third", { label: "Into the final third", domain: [0, 100], decimals: 0 }),
  ])
  .titleHeader("France's first-half passing", {
    kicker: "2018 World Cup final",
    subtitle: "Completed passes against Croatia, by passer",
  })
  .sourceNote("Data: StatsBomb open data (match 8658), as socceraction SPADL")
  .theme("sofa")
  .rowKey("player_id")
  .build();
const table = createTable(spec, rows, { pageSize: 6 });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt") as Element, table);
export default host;
