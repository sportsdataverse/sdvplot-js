// Oracle for packages/sdvplot/src/matchup-colors.ts: Game on Paper's own `pickGameColors`, run on real CFB
// matchups with the sdvplot cfb shard's colours as input, written to fixtures/matchup-colors/oracle.json.
//   GOP_REPO=<game-on-paper-app> CFB_SCHEDULE_DIR=<cfbfastR-cfb-raw/cfb/schedules/csv> pnpm oracle:matchup-colors
// GoP is read-only: misc.ts is taken from its HEAD commit (`git show`), its imports (used only by unrelated
// functions) stripped, three of its internal helpers exported (for the "deep" selection below; behaviour
// unchanged), and the copy imported from a temp dir.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Papa from "papaparse";
import { teamColorsSync } from "../../packages/sdvplot/src/colors.js";
import { INDEX_VERSION } from "../../packages/sdvplot/src/data/index.js";
import { setWarningHandler } from "../../packages/sdvplot/src/errors.js";
import { loadLeague } from "../../packages/sdvplot/src/index-data.js";

type Pair = { home: string; away: string };
type Source = { color: string; alternateColor: string | null };
type Gop = {
  pickGameColors: (home: Source, away: Source) => { light: Pair; dark: Pair };
  deltaE2000: (a: string, b: string) => number;
  contrastRatio: (a: string, b: string) => number;
  hexToLab: (hex: string) => number[];
  lab2rgb: (lab: number[]) => number[];
  rgbArrayToHex: (rgb: number[]) => string;
  GAME_BACKGROUNDS: { light: string; dark: string };
  GAME_COLOR_MIN_DELTA_E: number;
  GAME_COLOR_MIN_CONTRAST: number;
};
type Why = "clash" | "unreadable" | "stuck" | "deep" | "random";

const gopRepo = resolve(process.env.GOP_REPO ?? "../../game-on-paper-dev/game-on-paper-app");
const scheduleDir = resolve(
  process.env.CFB_SCHEDULE_DIR ?? "../cfbfastR-dev/cfbfastR-cfb-raw/cfb/schedules/csv",
);
const out = resolve("fixtures/matchup-colors/oracle.json");
const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 1 << 26 }).trim();

const gopCommit = git(gopRepo, "rev-parse", "HEAD");
const gopFile = "astro/src/utils/misc.ts";
const tmp = join(mkdtempSync(join(tmpdir(), "gop-misc-")), "misc.ts");
const src = git(gopRepo, "show", `${gopCommit}:${gopFile}`).replace(/^import .*$/gm, "");
writeFileSync(tmp, `${src}\nexport { hexToLab, lab2rgb, rgbArrayToHex };\n`);
const gop = (await import(pathToFileURL(tmp).href)) as Gop;

const bgs = Object.values(gop.GAME_BACKGROUNDS);
const readable = (c: string, bg: string) => gop.contrastRatio(c, bg) >= gop.GAME_COLOR_MIN_CONTRAST;
const apart = (x: string, y: string) => gop.deltaE2000(x, y) >= gop.GAME_COLOR_MIN_DELTA_E;
// GoP's readableVariant (an inner closure of pickPairOn), rebuilt from its exported helpers; selection only
const variant = (c: string, bg: string) => {
  if (readable(c, bg)) return c;
  const [L0, a, b] = gop.hexToLab(c) as [number, number, number];
  const dir = (gop.hexToLab(bg)[0] as number) >= 50 ? -1 : 1;
  for (let k = 1; k <= 100; k++) {
    const v = gop.rgbArrayToHex(gop.lab2rgb([L0 + dir * k, a, b]));
    if (readable(v, bg)) return v;
  }
  return c;
};

setWarningHandler(() => {}); // ids sdvplot has no cfb team for are skipped below
await loadLeague("cfb");
const hex = (v: string | undefined) =>
  /^#?[0-9a-f]{6}$/i.test(v ?? "") ? `#${v?.replace("#", "").toLowerCase()}` : null;
type Case = {
  game_id: string;
  season: number;
  week: number;
  why: Why;
  home_id: string;
  away_id: string;
  home: string;
  away: string;
  input: { home: Source; away: Source };
  espn: { home: [string | null, string | null]; away: [string | null, string | null] };
  expected: { light: Pair; dark: Pair };
};
type Game = Omit<Case, "why" | "expected"> & {
  de: number;
  minContrast: number;
  stuck: boolean;
  deep: boolean;
};
const seen = new Set<string>();
const games: Game[] = [];
const files = readdirSync(scheduleDir)
  .filter((f) => /^cfb_schedule_\d{4}\.csv$/.test(f))
  .sort()
  .reverse(); // newest first, so a pair's most recent meeting is the one kept
for (const f of files) {
  type Row = Record<string, string>;
  const csv = readFileSync(join(scheduleDir, f), "utf8");
  for (const r of Papa.parse<Row>(csv, { header: true, skipEmptyLines: true }).data) {
    if (!/^true$/i.test(r.status_type_completed ?? "")) continue;
    const ids = [r.home_id ?? "", r.away_id ?? ""];
    const key = [...ids].sort().join("-");
    if (seen.has(key)) continue;
    const [hp, ap] = teamColorsSync("cfb", ids, { idSystem: "espn" });
    const [hs, as] = teamColorsSync("cfb", ids, { idSystem: "espn", which: "secondary" });
    if (!hp || !ap) continue; // a team sdvplot has no colour for: nothing to compare
    seen.add(key);
    const cands = [
      [hp, ap],
      [hp, as],
      [hs, ap],
      [hs, as],
    ].filter((p): p is [string, string] => !!p[0] && !!p[1]);
    // on some theme no candidate is both readable and apart: GoP moves L*
    const stuckOn = bgs.filter(
      (bg) => !cands.some(([x, y]) => readable(x, bg) && readable(y, bg) && apart(x, y)),
    );
    games.push({
      game_id: r.game_id ?? "",
      season: Number(r.season),
      week: Number(r.week),
      home_id: ids[0] as string,
      away_id: ids[1] as string,
      home: r.home_display_name ?? "",
      away: r.away_display_name ?? "",
      input: {
        home: { color: hp, alternateColor: hs ?? null },
        away: { color: ap, alternateColor: as ?? null },
      },
      espn: {
        home: [hex(r.home_color), hex(r.home_alternate_color)],
        away: [hex(r.away_color), hex(r.away_alternate_color)],
      },
      de: gop.deltaE2000(hp, ap),
      minContrast: Math.min(...bgs.flatMap((bg) => [gop.contrastRatio(hp, bg), gop.contrastRatio(ap, bg)])),
      stuck: stuckOn.length > 0,
      // ... and no readable variant of a candidate separates either: GoP's last stage (both L* move)
      deep: stuckOn.some((bg) => !cands.some(([x, y]) => apart(variant(x, bg), variant(y, bg)))),
    });
  }
}

// Selection: every game that reaches GoP's last stage, the 20 closest primaries, the 10 least readable of
// the rest, 15 more where every candidate fails on some theme, and 20 at random (seeded) from what remains.
const picked = new Map<string, Why>();
const take = (why: Why, list: Game[], n: number) => {
  for (const g of list.filter((g) => !picked.has(g.game_id)).slice(0, n)) picked.set(g.game_id, why);
};
take(
  "deep",
  games.filter((g) => g.deep),
  Number.POSITIVE_INFINITY,
);
take(
  "clash",
  [...games].sort((x, y) => x.de - y.de),
  20,
);
take(
  "unreadable",
  games.filter((g) => g.de >= gop.GAME_COLOR_MIN_DELTA_E).sort((x, y) => x.minContrast - y.minContrast),
  10,
);
take(
  "stuck",
  games.filter((g) => g.stuck),
  15,
);
let seed = 2025;
const rand = () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rest = games.filter((g) => !picked.has(g.game_id));
for (let i = rest.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [rest[i], rest[j]] = [rest[j] as Game, rest[i] as Game];
}
take("random", rest, 20);

const cases: Case[] = games
  .filter((g) => picked.has(g.game_id))
  .map(({ de, minContrast, stuck, deep, ...g }) => ({
    ...g,
    why: picked.get(g.game_id) as Why,
    expected: gop.pickGameColors(g.input.home, g.input.away),
  }));
const differs = (c: Case) =>
  [c.input.home, c.input.away].some((s, i) => {
    const e = i === 0 ? c.espn.home : c.espn.away;
    return s.color !== e[0] || s.alternateColor !== e[1];
  });
const scheduleRoot = git(scheduleDir, "rev-parse", "--show-toplevel");
const byWhy: Record<string, number> = {};
for (const c of cases) byWhy[c.why] = (byWhy[c.why] ?? 0) + 1;
const meta = {
  gop_commit: gopCommit,
  gop_file: gopFile,
  schedule_dir: relative(scheduleRoot, scheduleDir).replaceAll("\\", "/"),
  schedule_seasons: `${files.at(-1)?.slice(13, 17)}-${files[0]?.slice(13, 17)}`,
  schedule_commit: git(scheduleDir, "log", "-1", "--format=%H", "--", "."),
  index_version: INDEX_VERSION,
  run_date: new Date().toISOString().slice(0, 10),
  matchups: games.length,
  deep_matchups: games.filter((g) => g.deep).length,
  pairs: cases.length,
  by_why: byWhy,
  espn_colors_differ: cases.filter(differs).length,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ meta, cases }, null, 1)}\n`);
console.log(meta);
