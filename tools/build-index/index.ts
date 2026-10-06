import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import Papa from "papaparse";
import { HEADER, emitConstModule, leagueFirstSeason } from "./emit.js";
import { type ManifestRow, leagueMarks } from "./marks.js";

const PY = resolve(process.env.SDVPLOT_PY_REPO ?? "../sdvplot");
const OUT = resolve("packages/sdvplot/src/data");
const MANIFEST_URL = "https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/manifest/marks.csv";
const PLAYERS_URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.parquet";
const MIN_MANIFEST_ROWS = 10_000; // sanity floor: today 44,462; below this the fetch is truncated/empty
const MIN_GSIS_IDS = 1_000; // sanity floor: today ~3k+
const MANIFEST_COLUMNS = [
  "level",
  "league",
  "entity_id",
  "mark_type",
  "variant",
  "valid_from",
  "valid_to",
  "source",
  "sha256",
  "ext",
  "width",
  "height",
  "archive_url",
  "first_seen",
];
const check = process.argv.includes("--check");

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

async function readParquet(file: ArrayBuffer, columns?: string[]): Promise<Row[]> {
  return (await parquetReadObjects({ file, compressors, ...(columns ? { columns } : {}) })) as Row[];
}
const toAB = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.arrayBuffer();
}

const files = new Map<string, string>();
const put = (rel: string, src: string) => files.set(rel, src);

async function main() {
  if (!existsSync(join(PY, "src/sdvplot/data/teams.parquet"))) {
    if (check && existsSync(OUT)) {
      console.log("build-index --check: Python repo absent; skipping (generated files committed)");
      return;
    }
    throw new Error(`sdvplot Python repo not found at ${PY}; set SDVPLOT_PY_REPO`);
  }
  const teams = await readParquet(toAB(readFileSync(join(PY, "src/sdvplot/data/teams.parquet"))));
  const aliases = await readParquet(toAB(readFileSync(join(PY, "src/sdvplot/data/aliases.parquet"))));
  const indexVersion = readFileSync(join(PY, "src/sdvplot/data/INDEX_VERSION"), "utf8").trim();
  const manifestText = process.env.SDVPLOT_MANIFEST
    ? readFileSync(process.env.SDVPLOT_MANIFEST, "utf8")
    : new TextDecoder().decode(await fetchBytes(MANIFEST_URL));
  const parsed = Papa.parse<ManifestRow>(manifestText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length)
    throw new Error(`manifest CSV parse errors: ${JSON.stringify(parsed.errors.slice(0, 3))}`);
  const manifest = parsed.data;
  const missing = MANIFEST_COLUMNS.filter((c) => !(c in (manifest[0] ?? {})));
  if (missing.length) throw new Error(`manifest missing columns: ${missing.join(", ")}`);
  if (manifest.length < MIN_MANIFEST_ROWS)
    throw new Error(`manifest has ${manifest.length} rows (< ${MIN_MANIFEST_ROWS})`);
  const leagues = [...new Set(teams.map((t) => String(t.league)))].sort();

  const meta: Record<string, { latestSeason: number | null; firstSeason: number | null }> = {};
  let idxFirst: number | null = null;
  let idxLast: number | null = null;
  for (const lg of leagues) {
    const T = teams
      .filter((t) => t.league === lg)
      .map((t) => ({
        league: lg,
        team_id: String(t.team_id),
        abbr: str(t.abbr),
        name: str(t.name),
        short_name: str(t.short_name),
        location: str(t.location),
        program: str(t.program),
        conference_id: str(t.conference_id),
        conference: str(t.conference),
        color_primary: str(t.color_primary),
        color_secondary: str(t.color_secondary),
        color_source: str(t.color_source),
      }));
    const A = aliases
      .filter((a) => a.league === lg)
      .map((a) => ({
        id_system: String(a.id_system),
        value: String(a.value),
        team_id: String(a.team_id),
        valid_from: num(a.valid_from),
        valid_to: num(a.valid_to),
      }));
    const dated = A.filter((a) => a.id_system !== "mark");
    const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);
    const hi = nums([...dated.map((a) => a.valid_from), ...dated.map((a) => a.valid_to)]);
    const lo = nums([...A.map((a) => a.valid_from), ...A.map((a) => a.valid_to)]);
    meta[lg] = {
      latestSeason: hi.length ? Math.max(...hi) : null,
      firstSeason: leagueFirstSeason(A),
    };
    if (lo.length) {
      idxFirst = Math.min(idxFirst ?? Number.POSITIVE_INFINITY, ...lo);
      idxLast = Math.max(idxLast ?? Number.NEGATIVE_INFINITY, ...lo);
    }
    put(`teams/${lg}.ts`, emitConstModule("teams", "Team", T));
    put(`aliases/${lg}.ts`, emitConstModule("aliases", "Alias", A));
    put(`marks/${lg}.ts`, emitConstModule("marks", "MarkRow", leagueMarks(lg, manifest, A)));
  }
  const localPlayers = join(PY, "../nflverse-players.parquet");
  const players = existsSync(localPlayers)
    ? await readParquet(toAB(readFileSync(localPlayers)))
    : await readParquet(await fetchBytes(PLAYERS_URL), ["gsis_id", "espn_id", "headshot"]);
  const gsis: Record<string, { espn_id: string | null; headshot: string | null }> = {};
  for (const p of players) {
    const id = str(p.gsis_id);
    const hs = str(p.headshot);
    if (id)
      gsis[id] = { espn_id: str(p.espn_id), headshot: hs && /^https:\/\/[^\s"'<>]+$/.test(hs) ? hs : null };
  }
  if (Object.keys(gsis).length < MIN_GSIS_IDS)
    throw new Error(`players parquet yielded ${Object.keys(gsis).length} gsis ids (< ${MIN_GSIS_IDS})`);
  put(
    "nfl_gsis.ts",
    `${HEADER}export const NFL_GSIS: Readonly<Record<string, { espn_id: string | null; headshot: string | null }>> = ${JSON.stringify(gsis)};\n`,
  );
  put(
    "index.ts",
    `${HEADER}export const LEAGUES = ${JSON.stringify(leagues)} as const;
export type League = (typeof LEAGUES)[number];
export const INDEX_VERSION: string = ${JSON.stringify(indexVersion)};
export const MANIFEST_LAST_MODIFIED: string = ${JSON.stringify(new Date().toISOString().slice(0, 10))};
export const INDEX_FIRST_SEASON: number | null = ${idxFirst}; export const INDEX_LAST_ALIAS_SEASON: number | null = ${idxLast};
export const LEAGUE_META: Readonly<Record<League, { latestSeason: number | null; firstSeason: number | null }>> = ${JSON.stringify(meta)};
export interface Team { league: League; team_id: string; abbr: string | null; name: string | null; short_name: string | null; location: string | null; program: string | null; conference_id: string | null; conference: string | null; color_primary: string | null; color_secondary: string | null; color_source: string | null }
export interface Alias { id_system: string; value: string; team_id: string; valid_from: number | null; valid_to: number | null }
export interface MarkRow { team_id: string; mark_type: "logo" | "wordmark"; variant: string; valid_from: number | null; valid_to: number | null; source: string; source_rank: number; first_seen: string; sha256: string; ext: string; width: number | null; height: number | null; archive_url: string }
export interface LeagueData { teams: readonly Team[]; aliases: readonly Alias[]; marks: readonly MarkRow[] }
export const loaders: Readonly<Record<League, () => Promise<LeagueData>>> = {
${leagues.map((lg) => `  ${JSON.stringify(lg)}: async () => { const [t, a, m] = await Promise.all([import("./teams/${lg}.js"), import("./aliases/${lg}.js"), import("./marks/${lg}.js")]); return { teams: t.teams, aliases: a.aliases, marks: m.marks }; },`).join("\n")}
};
`,
  );
  // MANIFEST_LAST_MODIFIED changes daily: --check ignores that one line.
  const strip = (s: string) => s.replace(/^export const MANIFEST_LAST_MODIFIED.*$/m, "");
  if (check) {
    const bad = [...files]
      .filter(
        ([rel, src]) =>
          !existsSync(join(OUT, rel)) || strip(readFileSync(join(OUT, rel), "utf8")) !== strip(src),
      )
      .map(([rel]) => rel);
    if (bad.length) {
      console.error(
        `build-index --check: stale generated files:\n  ${bad.join("\n  ")}\nrun: pnpm build:index`,
      );
      process.exit(1);
    }
    console.log("build-index --check: up to date");
    return;
  }
  rmSync(OUT, { recursive: true, force: true });
  for (const [rel, src] of files) {
    mkdirSync(join(OUT, rel, ".."), { recursive: true });
    writeFileSync(join(OUT, rel), src);
  }
  console.log(`wrote ${files.size} files for ${leagues.length} leagues (INDEX_VERSION ${indexVersion})`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
