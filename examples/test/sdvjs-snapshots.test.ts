// The "Workflows with sdv-js" notebooks' snapshots (fixtures/sdvjs): each is the ESPN response verbatim, the page's
// cut of it parses to the very rows the whole response does, and the page's own data steps
// (notebooks/src/components/workflows.js) re-derive the facts each page states from it.
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type Snapshot,
  checkVendored,
  parseAll,
  parser,
  provenance,
  rawText,
  sha256,
  trim,
} from "../../notebooks/scripts/sdvjs.js";
import { abs } from "../sources.js";

type Row = Record<string, unknown>;
type Section = (name: string) => Row[];
// the pages' data steps: plain JavaScript, typed here for the test
const W = (await import(pathToFileURL(abs("notebooks/src/components/workflows.js")).href)) as {
  winProbability(section: Section): {
    home: { team: { abbreviation: string }; score: string; winner: boolean };
    away: { team: { abbreviation: string }; score: string; winner: boolean };
    rows: { wp: number; swing: number; matched: boolean; play: string }[];
  };
  fieldGoals(plays: Row[]): Row[];
  checkJoinKey(left: Row[], leftKey: string, right: Row[], rightKey: string): void;
  idTypes(rows: Row[], key: string): string;
  boxScore(box: Row[], shots: Row[]): { team: string; fga: number; charted: number }[];
  gameLog(raw: unknown, rows: Row[]): { points: number; note: string; block: string }[];
  BLOCKS: Record<string, (g: unknown) => boolean>;
  exhibitions(games: unknown[]): { note: string }[];
};

const prov = provenance();
const parse = await parser();
const snap = (name: string): Snapshot => {
  const s = prov.snapshots.find((x) => x.name === name);
  if (!s) throw new Error(`no snapshot ${name}`);
  return s;
};
const raw = (name: string): Row => JSON.parse(rawText(snap(name))) as Row;
const rows = (r: unknown, endpoint: string, section?: string): Row[] =>
  parse("espn", endpoint, r, section) as Row[];

describe("sdv-js snapshots", () => {
  it("vendor the pinned sportsdataverse-js parser bundle", () => {
    expect(() => checkVendored(prov)).not.toThrow();
    expect(prov.parser.sdv_js_commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("are the five the pages read", () => {
    expect(prov.snapshots.map((s) => s.page).sort()).toEqual(
      ["game-dashboard", "player-trend", "ratings", "scoreboard", "win-probability"].sort(),
    );
  });

  for (const s of prov.snapshots)
    it(`${s.name}: the response as served, and the page's cut parses to the same rows`, () => {
      const text = rawText(s);
      expect(Buffer.byteLength(text)).toBe(s.bytes);
      expect(sha256(text)).toBe(s.sha256);
      const full = parseAll(parse, s, JSON.parse(text));
      const cut = parseAll(parse, s, trim(JSON.parse(text) as Record<string, unknown>, s));
      s.parsed.forEach((p, i) => {
        expect(full[i]).toHaveLength(p.rows);
        expect(sha256(JSON.stringify(full[i]))).toBe(p.rows_sha256);
        expect(sha256(JSON.stringify(cut[i]))).toBe(p.rows_sha256);
      });
    });
});

describe("the pages' data steps on the snapshots", () => {
  it("scoreboard: the NBA's 7 games of 2024-03-17, all final, Orlando 111 Toronto 96 among them", () => {
    const games = rows(raw("scoreboard_nba_20240317"), "scoreboard");
    expect(games).toHaveLength(7);
    expect(games.every((g) => g.status_type_completed === true)).toBe(true);
    expect(games.find((g) => g.game_id === "401585607")).toMatchObject({
      home_abbreviation: "ORL",
      home_score: "111",
      away_abbreviation: "TOR",
      away_score: "96",
    });
  });

  it("win-probability: Baltimore at Kansas City, 27-20, 188 rows each joined to its play but the pregame line", () => {
    const r = raw("summary_nfl_401671789");
    const { home, away, rows: wp } = W.winProbability((name) => rows(r, "summary", name));
    expect([home.team.abbreviation, home.score, home.winner]).toEqual(["KC", "27", true]);
    expect([away.team.abbreviation, away.score]).toEqual(["BAL", "20"]);
    expect(wp).toHaveLength(188);
    expect(wp.filter((d) => !d.matched).map((d) => d.play)).toEqual(["Before kickoff"]);
    expect(wp.at(-1)?.wp).toBe(1);
    // the page's prose: above 50% after 95% of plays, a low of 38%, and the two largest swings
    expect(wp.filter((d) => d.wp > 0.5).length / wp.length).toBeCloseTo(0.952, 3);
    expect(Math.min(...wp.map((d) => d.wp))).toBe(0.381);
    const top = [...wp].sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing)).slice(0, 2);
    expect(top.map((d) => Math.round(1000 * d.swing) / 10)).toEqual([-21.4, -20.7]);
    expect(top.map((d) => d.play.match(/L\.Jackson pass deep right to (\S+)/)?.[1])).toEqual([
      "R.Bateman",
      "I.Likely",
    ]);
  });

  it("game-dashboard: one id type on both sides of the join, and every player's charted attempts match his FGA", () => {
    const r = raw("summary_nba_401585607");
    const shots = W.fieldGoals(rows(r, "summary", "plays"));
    const box = rows(r, "summary", "boxscore_player");
    expect(W.idTypes(shots, "shooter_id")).toBe("string");
    expect(W.idTypes(box, "athlete_id")).toBe("string");
    expect(() => W.checkJoinKey(shots, "shooter_id", box, "athlete_id")).not.toThrow();
    // the check fires on the int-vs-string mismatch it exists for
    const numeric = box.map((b) => ({ ...b, athlete_id: Number(b.athlete_id) }));
    expect(() => W.checkJoinKey(shots, "shooter_id", numeric, "athlete_id")).toThrow(/differs in type/);
    // a live game with no located shot yet has nothing to join, so nothing to check
    expect(() => W.checkJoinKey([], "shooter_id", box, "athlete_id")).not.toThrow();
    const players = W.boxScore(box, shots);
    expect(shots).toHaveLength(169);
    expect(players.every((p) => p.charted === p.fga)).toBe(true);
    expect(players.reduce((a, p) => a + p.fga, 0)).toBe(169);
  });

  it("ratings: the 30 teams of the final 2024-25 season, Oklahoma City +12.9 at 68-14", () => {
    const r = raw("standings_nba_2025");
    expect((r.season as { displayName: string }).displayName).toBe("2024-25");
    const teams = rows(r, "standings");
    expect(teams).toHaveLength(30);
    const diff = (t: Row) => Number(t.avg_points_for) - Number(t.avg_points_against);
    const [okc, cle] = [...teams].sort((a, b) => diff(b) - diff(a));
    expect([okc?.team_abbreviation, okc?.wins, okc?.losses, diff(okc as Row).toFixed(1)]).toEqual([
      "OKC",
      68,
      14,
      "12.9",
    ]);
    expect([cle?.team_abbreviation, cle?.wins, diff(cle as Row).toFixed(1)]).toEqual(["CLE", 64, "9.5"]);
  });

  it("player-trend: 73 logged regular-season games, 71 that count, 1,822 points (LeBron James's 2023-24 line)", () => {
    const r = raw("athlete_gamelog_nba_1966_2024");
    const games = W.gameLog(r, rows(r, "athlete_gamelog"));
    const regular = games.filter(W.BLOCKS["Regular season"] as (g: unknown) => boolean);
    expect(regular).toHaveLength(71);
    expect(regular.reduce((a, g) => a + g.points, 0)).toBe(1822);
    expect(W.exhibitions(games).map((g) => g.note)).toHaveLength(2);
  });
});
