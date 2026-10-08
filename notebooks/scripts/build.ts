import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { DEFINES, SOURCES, abs } from "../../examples/sources.js";
import { NBA_SHOTS, STANDINGS } from "../../examples/src/data.js";

const NB = abs("notebooks");
const ENTRIES: Readonly<Record<string, string>> = {
  sdvplot: "@sportsdataverse/sdvplot",
  "sdvplot-plot": "@sportsdataverse/sdvplot/plot",
  sporty: "@sportsdataverse/sporty",
  "sporty-svg": "@sportsdataverse/sporty/svg",
  "sporty-plot": "@sportsdataverse/sporty/plot",
  sdvtables: "@sportsdataverse/sdvtables",
  "sdvtables-html": "@sportsdataverse/sdvtables/html",
};

// 1. The packages, bundled from source into local modules: one shared copy of sdvplot, the league shards as lazy
//    chunks. Framework keeps only the first rollup chunk of a node_modules import (framework dist/node.js:98-99),
//    which would drop those shards, so the pages import ./_sdv/*.js instead of the package names.
rmSync(join(NB, "src/_sdv"), { recursive: true, force: true });
await build({
  entryPoints: Object.fromEntries(
    Object.entries(ENTRIES).map(([out, spec]) => [out, abs(SOURCES[spec] ?? "")]),
  ),
  bundle: true,
  splitting: true,
  format: "esm",
  target: "es2022",
  outdir: join(NB, "src/_sdv"),
  tsconfig: abs("examples/tsconfig.json"),
  external: ["@observablehq/plot", "d3", "react", "react/jsx-runtime", "react-dom"],
  define: DEFINES,
  logLevel: "warning",
});

// 2. Sample data the pages read with FileAttachment (real rows: spec §7; provenance in examples/src/data.ts).
// Framework stamps each attachment with its file's mtime: a fixed one (the epoch) keeps two builds byte-identical.
mkdirSync(join(NB, "src/data"), { recursive: true });
for (const [name, rows] of [
  ["standings", STANDINGS],
  ["nba_shots", NBA_SHOTS],
] as const) {
  const file = join(NB, `src/data/${name}.json`);
  writeFileSync(file, `${JSON.stringify(rows)}\n`);
  utimesSync(file, 0, 0);
}

// 3. Build, then prove the output is hermetic and serves from /notebooks/.
rmSync(join(NB, "dist"), { recursive: true, force: true });
execSync("observable build", { cwd: NB, stdio: "inherit" });
const dist = join(NB, "dist");
if (existsSync(join(dist, "_npm")))
  throw new Error("a page pulled an npm: module from jsDelivr; import it instead");
for (const f of readdirSync(dist).filter((n) => n.endsWith(".html")))
  if (/(?:href|src)="\/_/.test(readFileSync(join(dist, f), "utf8")))
    throw new Error(`${f}: an absolute /_ asset path would break under /notebooks/`);
const shards = readdirSync(join(dist, "_import/_sdv")).filter((n) => n.startsWith("nfl-"));
if (shards.length === 0)
  throw new Error("the league shards were not copied: loadLeague would fail in the browser");
console.log(`notebooks: built into notebooks/dist (${shards.length} nfl shard chunks present)`);
