// Captures the "Workflows with sdv-js" snapshots: each ESPN response verbatim, gzipped into fixtures/sdvjs, with its
// URL, capture time, size, sha256 and the row counts and row hashes the vendored parser gives, into provenance.json.
// Never run by a build (the builds read only what is committed); run it by hand to refresh a snapshot:
//
//   cd notebooks && npx tsx scripts/snapshot-sdvjs.ts [name ...]          (no name: every snapshot)
//   cd notebooks && npx tsx scripts/snapshot-sdvjs.ts --from <file.json.gz> --captured-at <ISO> <name>
//
// The second form records a capture made elsewhere (sportsdataverse-js's own fixture), so both repositories share
// one capture. Then run `pnpm test` (examples/test/sdvjs-snapshots.test.ts) and rebuild the notebooks.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { FIXTURES, type Provenance, type Snapshot, parseAll, parser, sha256, trim } from "./sdvjs.js";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
type Spec = Omit<Snapshot, "captured_at" | "bytes" | "sha256" | "file" | "parsed"> & {
  parsed: { endpoint: string; section?: string }[];
};
const SPECS: readonly Spec[] = [
  {
    name: "scoreboard_nba_20240317",
    page: "scoreboard",
    url: `${SITE}/basketball/nba/scoreboard?dates=20240317`,
    sdv_js: "sdv.nba.espnNbaScoreboard({ dates: '20240317', parsed: true })",
    keep: ["leagues", "events"],
    parsed: [{ endpoint: "scoreboard" }],
  },
  {
    name: "summary_nfl_401671789",
    page: "win-probability",
    url: `${SITE}/football/nfl/summary?event=401671789`,
    sdv_js: "sdv.nfl.espnNflSummary({ event_id: 401671789, parsed: true, section })",
    keep: ["header", "winprobability", "drives"],
    parsed: [
      { endpoint: "summary", section: "header" },
      { endpoint: "summary", section: "winprobability" },
      { endpoint: "summary", section: "drive_plays" },
    ],
  },
  {
    name: "summary_nba_401585607",
    page: "game-dashboard",
    url: `${SITE}/basketball/nba/summary?event=401585607`,
    sdv_js: "sdv.nba.espnNbaSummary({ event_id: 401585607, parsed: true, section })",
    keep: ["header", "plays", "boxscore"],
    parsed: [
      { endpoint: "summary", section: "header" },
      { endpoint: "summary", section: "plays" },
      { endpoint: "summary", section: "boxscore_player" },
    ],
  },
  {
    name: "standings_nba_2025",
    page: "ratings",
    url: "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2025",
    sdv_js: "sdv.nba.espnNbaStandings({ season: 2025, parsed: true })",
    keep: ["children", "season"],
    parsed: [{ endpoint: "standings" }],
  },
  {
    name: "athlete_gamelog_nba_1966_2024",
    page: "player-trend",
    url: "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/1966/gamelog?season=2024",
    sdv_js: "sdv.nba.espnNbaPlayerGamelog({ athlete_id: '1966', season: 2024, parsed: true })",
    keep: ["names", "labels", "displayNames", "events", "seasonTypes"],
    cut_links: true,
    parsed: [{ endpoint: "athlete_gamelog" }],
  },
];

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const from = flag("--from");
const capturedAt = flag("--captured-at");
if (from && (!capturedAt || args.length !== 1))
  throw new Error("--from needs --captured-at <ISO> and exactly one snapshot name");

const file = join(FIXTURES, "provenance.json");
const prov = JSON.parse(readFileSync(file, "utf8")) as Provenance;
const parse = await parser();
for (const spec of SPECS.filter((s) => args.length === 0 || args.includes(s.name))) {
  let body: Buffer;
  let at: string;
  if (from) {
    body = gunzipSync(readFileSync(from));
    at = capturedAt as string;
  } else {
    const res = await fetch(spec.url);
    if (!res.ok) throw new Error(`${spec.url}: HTTP ${res.status}`);
    body = Buffer.from(await res.arrayBuffer());
    at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  const raw = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  const rows = parseAll(parse, spec, raw);
  const trimmed = parseAll(parse, spec, trim(raw, spec));
  const parsed = spec.parsed.map((p, i) => {
    const r = rows[i];
    if (!Array.isArray(r) || r.length === 0)
      throw new Error(`${spec.name}: ${p.endpoint} ${p.section ?? ""} parsed no rows`);
    if (JSON.stringify(trimmed[i]) !== JSON.stringify(r))
      throw new Error(
        `${spec.name}: trimming to ${spec.keep.join(", ")} changes the ${p.section ?? p.endpoint} rows`,
      );
    return { ...p, rows: r.length, rows_sha256: sha256(JSON.stringify(r)) };
  });
  const gz = `${spec.name}.json.gz`;
  writeFileSync(join(FIXTURES, gz), gzipSync(body, { level: 9 }));
  const snap: Snapshot = {
    ...spec,
    captured_at: at,
    bytes: body.length,
    sha256: sha256(body),
    file: gz,
    parsed,
  };
  prov.snapshots = [...prov.snapshots.filter((s) => s.name !== spec.name), snap].sort(
    (a, b) => SPECS.findIndex((s) => s.name === a.name) - SPECS.findIndex((s) => s.name === b.name),
  );
  console.log(
    `${spec.name}: ${body.length} bytes, ${parsed.map((p) => `${p.section ?? p.endpoint} ${p.rows}`).join(", ")}`,
  );
}
writeFileSync(file, `${JSON.stringify(prov, null, 2)}\n`);
