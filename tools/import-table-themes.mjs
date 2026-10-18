#!/usr/bin/env node
// One-shot importer: survey specs (01/02/03-*.json) -> packages/sdvtables/data/table_themes.json (+ .sha256).
// Usage: node tools/import-table-themes.mjs <survey-specs-dir>
// De-dup rules (table-themes plan, Global Constraints): drop `reactablefmtr-*` (Tier 3 ships exact ports) and the
// survey `kenpom` / `ncaa` (house themes of that name exist); rename `espn`/`fivethirtyeight`/`pff` to `*-site`.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "2026.10.18";
const FILES = ["01-news.json", "02-sports-stats.json", "03-finance-science-libs.json"];
const DROP = new Set(["kenpom", "ncaa"]);
const RENAME = { espn: "espn-site", fivethirtyeight: "fivethirtyeight-site", pff: "pff-site" };

/**
 * Minimal data corrections (id -> dotted field -> value), each with the reason. Empty unless a survey entry fails the
 * registry test; never weaken the test, fix the data here.
 */
const CORRECTIONS = {};

const set = (root, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  let obj = root;
  for (const k of keys) obj = obj[k];
  obj[last] = value;
};

export function build(specsDir) {
  const out = {};
  for (const f of FILES) {
    for (const e of JSON.parse(readFileSync(join(specsDir, f), "utf8"))) {
      if (e.id.startsWith("reactablefmtr-") || DROP.has(e.id)) continue;
      const { _file, ...spec } = e;
      const id = RENAME[spec.id] ?? spec.id;
      if (id !== spec.id) {
        if (spec.theme === spec.id) spec.theme = id;
        spec.id = id;
      }
      if (out[id]) throw new Error(`duplicate id ${id}`);
      for (const [path, v] of Object.entries(CORRECTIONS[id] ?? {})) set(spec, path, v);
      out[id] = spec;
    }
  }
  const themes = Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((k) => [k, out[k]]),
  );
  return { version: VERSION, count: Object.keys(themes).length, themes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: import-table-themes.mjs <survey-specs-dir>");
  const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "sdvtables", "data");
  const bytes = Buffer.from(`${JSON.stringify(build(dir), null, 2)}\n`, "utf8"); // LF + trailing newline
  writeFileSync(join(dest, "table_themes.json"), bytes);
  writeFileSync(
    join(dest, "table_themes.json.sha256"),
    `${createHash("sha256").update(bytes).digest("hex")}\n`,
  );
  console.log(`wrote ${bytes.length} bytes`);
}
