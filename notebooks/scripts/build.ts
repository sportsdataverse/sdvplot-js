import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Plugin, build, transform } from "esbuild";
import { DEFINES, SOURCES, abs } from "../../examples/sources.js";
import {
  BKN_SHOTS_2026,
  KC_PHI_GAMES_2024,
  NBA_LEAGUE_2026,
  NBA_LEAGUE_SQUARE_2026,
  NBA_SHOTS,
  NBA_STANDINGS,
  NFL_TEAM_EPA_2024,
  NHL_SHOTS,
  NHL_STANDINGS,
  PWHL_GOALS,
  STANDINGS,
  SUPER_BOWL_LIX_TDS,
} from "../../examples/src/data.js";
import { BKN_GAMES } from "../../packages/sdvplot/test/shots/fixture.js";
import { checkVendored, provenance, rawText, trim, vendoredBody } from "./sdvjs.js";

const NB = abs("notebooks");
const ENTRIES: Readonly<Record<string, string>> = {
  sdvplot: "@sportsdataverse/sdvplot",
  "sdvplot-plot": "@sportsdataverse/sdvplot/plot",
  sporty: "@sportsdataverse/sporty",
  "sporty-svg": "@sportsdataverse/sporty/svg",
  "sporty-plot": "@sportsdataverse/sporty/plot",
  sdvtables: "@sportsdataverse/sdvtables",
  "sdvtables-html": "@sportsdataverse/sdvtables/html",
  interact: "@sportsdataverse/sdvplot/interact",
  shots: "@sportsdataverse/sdvplot/shots",
  bins: "@sportsdataverse/sdvplot/bins",
  plotly: "@sportsdataverse/sdvplot/plotly",
  vega: "@sportsdataverse/sdvplot/vega",
  echarts: "@sportsdataverse/sdvplot/echarts",
  chartjs: "@sportsdataverse/sdvplot/chartjs",
};
/**
 * The chart libraries the "Chart libraries" page draws with, bundled from the examples workspace's own copies (the
 * versions the docs draw with; pnpm-locked, so nothing new to install): Framework would fetch an npm: import from
 * jsDelivr, which step 3 forbids. Each is its own minified module, loaded only by that page.
 */
const LIBS: Readonly<Record<string, string>> = {
  plotly: 'export { default } from "plotly.js-basic-dist-min";',
  vega: 'export { default } from "vega-embed";',
  // what the page's options use, not the full build (the docs' examples/src/draw/echarts.ts does the same)
  echarts: `import { BarChart, CustomChart, ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
use([BarChart, CustomChart, ScatterChart, GridComponent, TooltipComponent, SVGRenderer]);
export { init };`,
  chartjs: 'export { Chart, registerables } from "chart.js";',
};
const libs: Plugin = {
  name: "notebook-libs",
  setup(b) {
    b.onResolve({ filter: /^lib:/ }, (a) => ({ path: a.path.slice(4), namespace: "lib" }));
    b.onLoad({ filter: /.*/, namespace: "lib" }, (a) => ({
      contents: LIBS[a.path],
      resolveDir: abs("examples"),
      loader: "js",
    }));
  },
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
await build({
  entryPoints: Object.fromEntries(Object.keys(LIBS).map((lib) => [lib, `lib:${lib}`])),
  plugins: [libs],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  outdir: join(NB, "src/_sdv/lib"),
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

// sportsdataverse-js's parser for the "Workflows with sdv-js" pages: the vendored bundle, refused unless it is the
// pinned upstream bytes, then minified. The pages parse ESPN JSON with it, from a snapshot or a live fetch.
const prov = provenance();
checkVendored(prov);
const parsers = await transform(vendoredBody(), {
  format: "esm",
  minify: true,
  target: "es2022",
  legalComments: "eof",
});
writeFileSync(join(NB, "src/_sdv/sdv-parsers.js"), parsers.code);

// 2. Sample data the pages read with FileAttachment (real rows: spec §7; provenance in examples/src/data.ts).
// Framework stamps each attachment with its file's mtime: a fixed one (the epoch) keeps two builds byte-identical.
mkdirSync(join(NB, "src/data"), { recursive: true });
for (const [name, rows] of [
  ["standings", STANDINGS],
  ["nba_shots", NBA_SHOTS],
  ["nba_standings", NBA_STANDINGS],
  ["nhl_standings", NHL_STANDINGS],
  ["nhl_shots", NHL_SHOTS],
  ["pwhl_goals", PWHL_GOALS],
  ["nfl_epa_2024", NFL_TEAM_EPA_2024],
  ["kc_phi_games_2024", KC_PHI_GAMES_2024],
  ["super_bowl_lix_tds", SUPER_BOWL_LIX_TDS],
  ["bkn_shots_2026", BKN_SHOTS_2026],
  ["bkn_games_2026", BKN_GAMES],
  ["nba_league_2026", NBA_LEAGUE_2026],
  ["nba_league_square_2026", NBA_LEAGUE_SQUARE_2026],
] as const) {
  const file = join(NB, `src/data/${name}.json`);
  writeFileSync(file, `${JSON.stringify(rows)}\n`);
  utimesSync(file, 0, 0);
}
// The sdv-js snapshots (fixtures/sdvjs), each cut to the keys its page parses, and their provenance.
for (const [name, value] of [
  ...prov.snapshots.map((s) => [`sdvjs_${s.name}`, trim(JSON.parse(rawText(s)), s)] as const),
  ["sdvjs_provenance", prov] as const,
]) {
  const file = join(NB, `src/data/${name}.json`);
  writeFileSync(file, `${JSON.stringify(value)}\n`);
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
