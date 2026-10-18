#!/usr/bin/env node
// Vendors the canonical table-theme registry (+ .sha256) into sdvplot and sdvplotR, byte for byte.
// Usage: node tools/sync-table-themes.mjs [--py ../sdvplot] [--r ../sdvplotR]   (paths are repo roots)
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages", "sdvtables", "data");
const args = process.argv.slice(2);
const opt = (flag, dflt) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : dflt);
const dests = [
  join(resolve(root, opt("--py", "../sdvplot")), "src", "sdvplot", "data"),
  join(resolve(root, opt("--r", "../sdvplotR")), "inst", "extdata"),
];
for (const dir of dests) {
  mkdirSync(dir, { recursive: true });
  for (const f of ["table_themes.json", "table_themes.json.sha256"]) copyFileSync(join(src, f), join(dir, f));
  console.log(`synced -> ${dir}`);
}
