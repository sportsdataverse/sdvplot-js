// Runs api-extractor once per public entry: api-extractor.json (main entry) + api-extractor.<entry>.json.
// Usage (from a package dir): node ../../tools/api-extractor-all.mjs [--local]
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const configs = readdirSync(".")
  .filter((f) => /^api-extractor(\.[\w-]+)?\.json$/.test(f))
  .sort();
if (configs.length === 0) {
  console.error("api-extractor-all: no api-extractor*.json config found in", process.cwd());
  process.exit(1);
}
let failed = false;
for (const c of configs) {
  const args = ["exec", "api-extractor", "run", "-c", c, ...process.argv.slice(2)];
  const r = spawnSync("pnpm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
