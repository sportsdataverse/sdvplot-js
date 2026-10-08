import { preloadAll } from "../src/index.js";
await preloadAll(); // top-level await: the shards are loaded once per vitest worker
export const LEAGUE = "nfl" as const;
// resolve to team ids "12" and "2" in the committed shard — see test/parity fixtures
export const KC = "KC";
export const BUF = "BUF";
// literals, not KC/BUF: isolatedDeclarations cannot infer an exported `as const` that references another binding
export const ROWS = [
  { x: 10, y: -3, team: "KC" },
  { x: 20, y: -7, team: "BUF" },
] as const;
export const ROWS_UNKNOWN = [
  { x: 10, y: -3, team: "XXX" },
  { x: 20, y: -7, team: "KC" },
] as const;
