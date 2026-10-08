import { loadLeague, resolveSync } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Relocations resolve by season",
  tags: ["resolve", "nfl", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
await loadLeague("nhl");

export default {
  "OAK 2019": resolveSync("OAK", "nfl", { season: 2019 }),
  "LV 2024": resolveSync("LV", "nfl", { season: 2024 }),
  "QUE 1994": resolveSync("QUE", "nhl", { season: 1994 }),
  "COL 2024": resolveSync("COL", "nhl", { season: 2024 }),
};
