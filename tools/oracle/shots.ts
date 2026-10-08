// Golden outputs of blazing-the-nets' OWN shot-chart code on real 2026 NBA shots (spec §7: real data only).
// Usage (repo root): SHOTS_PARQUET=<path to shots_2026.parquet> [BTN_REPO=../blazing-the-nets] pnpm oracle:shots
// Writes fixtures/shots/{nba-2026-bkn-2000-columns.json, nba-2026-league.json, oracle.json}. Never hand-edit them.
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const BTN = resolve(process.env.BTN_REPO ?? "../blazing-the-nets");
const MAIN = "31427b8"; // blazing-the-nets main: lib/data/aggregate.ts, lib/charts/{shootingSignature,theme,hexShotChart}.ts
const MASTER = "35dfda6"; // blazing-the-nets master: src/utils/visuals/*.ts
const SHOTS_SHA = "edb7a9fe8ecef1095fa6b520543dfa6ea285cecae33d0563a1e76b6fa17ab002"; // nba_stats_shots/shots_2026.parquet
const BKN_SHA = "5322edd790cd828cb5b6593bdcb1dd3ba50d0cc10680ee1ba4dc5dbaaa9f11cb"; // btn test/fixtures/shots_2026_bkn_2000.parquet
// The versions blazing-the-nets main resolves (its package-lock.json); d3-hexbin is the one sdvplot-js never installs.
const D3 = [
  "d3-hexbin@0.2.2",
  "d3-array@3.2.4",
  "d3-delaunay@6.0.4",
  "d3-scale@4.0.2",
  "d3-scale-chromatic@3.1.0",
  "d3-selection@3.0.0",
  "d3-shape@3.2.0",
  "d3-transition@3.0.1",
];
const OUT = resolve("fixtures/shots");

interface ShotLite {
  game_id: string;
  x_legacy: number;
  y_legacy: number;
  shot_distance: number;
  shot_value: number;
  shot_result: string;
}
const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
async function readShots(path: string, want: string): Promise<ShotLite[]> {
  const buf = readFileSync(path);
  if (sha256(buf) !== want) throw new Error(`${path}: sha256 ${sha256(buf)} is not the pinned ${want}`);
  const file = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const columns = ["game_id", "x_legacy", "y_legacy", "shot_distance", "shot_value", "shot_result"];
  const rows = (await parquetReadObjects({ file, compressors, columns })) as Record<string, unknown>[];
  // hyparquet returns INT64 as bigint: one dtype per id at the boundary.
  return rows.map((r) => ({
    game_id: String(r.game_id),
    x_legacy: Number(r.x_legacy),
    y_legacy: Number(r.y_legacy),
    shot_distance: Number(r.shot_distance),
    shot_value: Number(r.shot_value),
    shot_result: String(r.shot_result),
  }));
}

const shotsPath = process.env.SHOTS_PARQUET;
if (!shotsPath)
  throw new Error(
    "set SHOTS_PARQUET (gh release download nba_stats_shots -R sportsdataverse/sportsdataverse-data -p shots_2026.parquet)",
  );
// Regular season only, as blazing-the-nets builds its league context (lib/pageData.ts:43, lib/data/shots.ts:46-53).
const league = (await readShots(shotsPath, SHOTS_SHA)).filter((s) => s.game_id.startsWith("002"));
const bkn = await readShots(join(BTN, "test/fixtures/shots_2026_bkn_2000.parquet"), BKN_SHA);

const tmp = mkdtempSync(join(tmpdir(), "sdv-shots-oracle-"));
try {
  for (const [commit, path, dir] of [
    [MAIN, "lib", "main"],
    [MASTER, "src/utils/visuals", "master"],
  ] as const) {
    mkdirSync(join(tmp, dir));
    execFileSync("git", ["-C", BTN, "archive", "-o", join(tmp, `${dir}.tar`), commit, path]);
    execFileSync("tar", ["-xf", `../${dir}.tar`], { cwd: join(tmp, dir) });
  }
  writeFileSync(join(tmp, "package.json"), '{"private":true,"type":"module"}');
  // One command string (constants only): Node 24 will not spawn npm.cmd without a shell, and args + shell is DEP0190.
  execSync(`npm i --no-audit --no-fund --silent ${D3.join(" ")}`, { cwd: tmp });
  const load = (p: string) => import(pathToFileURL(join(tmp, p)).href);
  const A = await load("main/lib/data/aggregate.ts");
  const S = await load("main/lib/charts/shootingSignature.ts");
  const T = await load("main/lib/charts/theme.ts");
  const H = await load("main/lib/charts/hexShotChart.ts");
  const B = await load("master/src/utils/visuals/bin.ts");
  const R = await load("master/src/utils/visuals/ribbonShots.ts");
  const { hexbin } = createRequire(join(tmp, "package.json"))("d3-hexbin") as {
    hexbin: () => { hexagon(r: number): string };
  };

  const idx10 = A.leagueHexIndex(league, 10);
  const idx15 = A.leagueHexIndex(league, 15); // main's HEX_RADIUS (lib/dashboard.ts:25)
  const lgFoot = A.fgPctByDistance(league);
  const lgBin3 = A.fgPctByDistance(league, 3); // BAR_BIN_FT (lib/dashboard.ts:26)
  const vs = A.vsLeague(A.fgPctByDistance(bkn), lgFoot);
  const box = { width: 500, height: 600, scale: 1, top: 1e9, pad: 0 }; // layoutHexes reads only the cap here
  const capOf = (h: unknown[], r: number): number => H.layoutHexes(h, r, box).cap;
  const vs10 = A.hexesVsLeague(bkn, idx10);
  const vs15 = A.hexesVsLeague(bkn, idx15);
  const diffs = Array.from({ length: 61 }, (_, i) => (i - 30) / 100); // -0.30 .. 0.30 by 0.01
  const zoneIds = A.ZONES as readonly string[];
  const master = bkn.map((s) => ({
    SHOT_DISTANCE: s.shot_distance,
    LOC_X: s.x_legacy,
    LOC_Y: s.y_legacy,
    SHOT_MADE_FLAG: s.shot_result === "Made" ? 1 : 0,
  }));
  const source = {
    shots: {
      release: "sportsdataverse/sportsdataverse-data nba_stats_shots/shots_2026.parquet",
      sha256: SHOTS_SHA,
      regular_rows: league.length,
    },
    bkn: {
      file: "blazing-the-nets test/fixtures/shots_2026_bkn_2000.parquet",
      sha256: BKN_SHA,
      rows: bkn.length,
    },
    blazing_the_nets: { main: MAIN, master: MASTER },
    d3: D3,
  };

  mkdirSync(OUT, { recursive: true });
  const write = (name: string, v: unknown): void => {
    writeFileSync(join(OUT, name), `${JSON.stringify(v)}\n`);
    console.log(`${name}: ${readFileSync(join(OUT, name)).length} bytes`);
  };
  write("nba-2026-bkn-2000-columns.json", {
    source: source.bkn,
    x_legacy: bkn.map((s) => s.x_legacy),
    y_legacy: bkn.map((s) => s.y_legacy),
    shot_distance: bkn.map((s) => s.shot_distance),
    shot_value: bkn.map((s) => s.shot_value),
    made: bkn.map((s) => (s.shot_result === "Made" ? 1 : 0)),
  });
  write("nba-2026-league.json", {
    source: source.shots,
    byFoot: lgFoot,
    byBin3: lgBin3,
    sides3: A.statsBySide(league, 3),
    hex10: idx10,
    hex15: idx15,
  });
  write("oracle.json", {
    source,
    main: {
      zoneOf: bkn.map((s) => zoneIds.indexOf(A.zoneOf(s))).join(""),
      zones: A.statsByZone(bkn),
      hex10: vs10,
      hex15: vs15,
      cap10: capOf(vs10, 10),
      cap15: capOf(vs15, 15),
      byFoot: A.fgPctByDistance(bkn),
      byBin3: A.fgPctByDistance(bkn, 3),
      sides: { c0: A.statsBySide(bkn), c75: A.statsBySide(bkn, 1, 35, 7.5), bin3: A.statsBySide(bkn, 3) },
      signature: S.signaturePoints(vs),
      ribbonEnd: S.ribbonEnd(vs),
      kernel: {
        sum: S.kernelSum(
          vs.map((b: { attempts: number }) => b.attempts),
          0.9,
        ),
        smooth: S.kernelSmooth(
          vs.map((b: { share: number }) => b.share),
          null,
          1,
        ),
      },
      diff: {
        x: diffs,
        light: diffs.map((d) => T.diffColor(d, "light")),
        dark: diffs.map((d) => T.diffColor(d, "dark")),
      },
      hexagon: [7.5, 10, 15].map((r) => ({ r, d: hexbin().hexagon(r) })),
    },
    master: {
      bin: B.default(master, 35),
      binLeftRight: B.binLeftRight(master, 35),
      ribbon: R.ribbonShots(master, 35),
    },
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
