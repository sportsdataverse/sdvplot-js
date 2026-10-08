import { LEAGUES, preloadAll, teams } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Preload every league, then count teams",
  tags: ["node", "preloadAll", "teams"],
} satisfies ExampleMeta;

// Every league shard plus the gsis map, so every *Sync function works for any league afterwards.
// A server does this once at start-up; a browser page loads only the leagues it draws.
await preloadAll();
const counts: Record<string, number> = {};
for (const league of LEAGUES) counts[league] = (await teams(league)).length;

export default counts;
