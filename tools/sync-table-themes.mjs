#!/usr/bin/env node
// Vendors the canonical table-theme registry (+ .sha256) into sdvplot and sdvplotR, byte for byte.
// Usage: node tools/sync-table-themes.mjs [--py ../sdvplot] [--r ../sdvplotR]   (paths are repo roots)
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};
const USAGE = "usage: --py <dir> --r <dir>";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages", "sdvtables", "data");
const args = process.argv.slice(2);
const opt = (flag, dflt) => {
  const i = args.indexOf(flag);
  if (i < 0) return dflt;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) die(USAGE);
  return v;
};
const files = ["table_themes.json", "table_themes.json.sha256"];
for (const f of files) if (!existsSync(join(src, f))) die(`missing source file: ${join(src, f)}`);
const roots = [resolve(root, opt("--py", "../sdvplot")), resolve(root, opt("--r", "../sdvplotR"))];
for (const r of roots)
  if (!existsSync(r) || !statSync(r).isDirectory()) die(`destination repo root does not exist: ${r}`);
const dests = [join(roots[0], "src", "sdvplot", "data"), join(roots[1], "inst", "extdata")];
for (const dir of dests) {
  mkdirSync(dir, { recursive: true });
  for (const f of files) copyFileSync(join(src, f), join(dir, f));
  console.log(`synced -> ${dir}`);
}
