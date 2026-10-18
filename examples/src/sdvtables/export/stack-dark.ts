import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { stackTables } from "@sportsdataverse/sdvtables/export";
import { prepare } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "stackTables on a dark theme: each table titles itself, ready for a dark PNG",
  tags: ["node", "table", "export", "stackTables", "midnight", "nfl"],
} satisfies ExampleMeta;

const rows = NFL_TEAM_EPA_2024.map((r) => ({
  team: r.team,
  off: r.off_epa / r.off_plays,
  def: r.def_epa / r.def_plays,
}));
const top = (key: "off" | "def", dir: 1 | -1) =>
  [...rows].sort((a, b) => dir * (b[key] - a[key])).slice(0, 5);
const table = (title: string, key: "off" | "def") =>
  defineTable<(typeof rows)[number]>()
    .columns((c) => [
      c.logo("team", { league: "nfl", includeName: true, label: "Team" }),
      c.colorPills(key, { label: "EPA/play", digits: 3, domain: [-0.25, 0.25], reverse: key === "def" }),
    ])
    .titleHeader(title, { kicker: "NFL 2024" })
    .theme("midnight")
    .build();
const offence = table("Best offences", "off");
const defence = table("Best defences", "def");
await prepare(offence);
// The page frame's own title is dark text for a white page, so the titles live in the tables. For the image,
// htmlToPNG(page, { background: "#0C0D10" }) fills the margin with midnight's ground instead of white.
export default stackTables(
  [
    { spec: offence, rows: top("off", 1) },
    { spec: defence, rows: top("def", -1) },
  ],
  { gap: 24, align: "left" },
);
