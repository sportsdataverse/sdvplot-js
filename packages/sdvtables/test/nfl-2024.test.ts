import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { NFL_2024 } from "./fixtures/nfl-2024.js";
import type { Standing } from "./fixtures/standings.js";

/** A source CSV in test/fixtures/nfl-2024 (no quoted fields) as rows of strings. */
function csv(file: string): Record<string, string>[] {
  const text = readFileSync(new URL(`./fixtures/nfl-2024/${file}`, import.meta.url), "utf8");
  const [head = "", ...lines] = text.trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

/** Solve `a x = b` by Gaussian elimination with partial pivoting (a is square and non-singular). */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] as number]);
  const at = (r: number, c: number): number => (m[r] as number[])[c] as number;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(at(r, c)) > Math.abs(at(p, c))) p = r;
    [m[c], m[p]] = [m[p] as number[], m[c] as number[]];
    for (let r = c + 1; r < n; r++) {
      const f = at(r, c) / at(c, c);
      for (let k = c; k <= n; k++) (m[r] as number[])[k] = at(r, k) - f * at(c, k);
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = at(r, n);
    for (let k = r + 1; k < n; k++) s -= at(r, k) * (x[k] as number);
    x[r] = s / at(r, r);
  }
  return x;
}

/** Simple Rating System: least-squares ratings r with r[home] - r[away] ≈ home margin, summing to zero. */
function srs(games: readonly { home: string; away: string; margin: number }[]): Map<string, number> {
  const teams = [...new Set(games.flatMap((g) => [g.home, g.away]))].sort();
  const idx = new Map(teams.map((t, i) => [t, i]));
  const a = teams.map(() => new Array<number>(teams.length).fill(1)); // the 11ᵀ constraint row folded in
  const b = new Array<number>(teams.length).fill(0);
  for (const g of games) {
    const h = idx.get(g.home) as number;
    const w = idx.get(g.away) as number;
    const ah = a[h] as number[];
    const aw = a[w] as number[];
    ah[h] = (ah[h] as number) + 1;
    aw[w] = (aw[w] as number) + 1;
    ah[w] = (ah[w] as number) - 1;
    aw[h] = (aw[h] as number) - 1;
    b[h] = (b[h] as number) + g.margin;
    b[w] = (b[w] as number) - g.margin;
  }
  const r = solve(a, b);
  return new Map(teams.map((t, i) => [t, r[i] as number]));
}

/** Every 2024 team's Standing, re-derived from the four source CSVs (see fixtures/nfl-2024/README.md). */
function derive(): Standing[] {
  const games = csv("nfl_games_2024_reg.csv").map((g) => ({
    week: Number(g.week),
    home: g.home_team as string,
    away: g.away_team as string,
    hs: Number(g.home_score),
    as: Number(g.away_score),
    hq: g.home_qb_id as string,
    aq: g.away_qb_id as string,
  }));
  const espn = new Map(csv("nfl_qb_espn_ids_2024.csv").map((p) => [p.gsis_id as string, p]));
  const epa = new Map(csv("nfl_epa_2024_reg.csv").map((e) => [e.team as string, e]));
  const divs = new Map(csv("nfl_divisions.csv").map((d) => [d.team as string, d]));
  const ratings = srs(games.map((g) => ({ home: g.home, away: g.away, margin: g.hs - g.as })));
  const order = [...ratings.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
  return [...ratings.keys()].map((team) => {
    const own = games
      .filter((g) => g.home === team || g.away === team)
      .sort((x, y) => x.week - y.week)
      .map((g) => (g.home === team ? { pf: g.hs, pa: g.as, qb: g.hq } : { pf: g.as, pa: g.hs, qb: g.aq }));
    const res = own.map((g) => (g.pf > g.pa ? "W" : g.pf < g.pa ? "L" : "T"));
    const starts = new Map<string, number>();
    for (const g of own) starts.set(g.qb, (starts.get(g.qb) ?? 0) + 1);
    const qb = espn.get(([...starts.entries()].sort((x, y) => y[1] - x[1])[0] as [string, number])[0]);
    const e = epa.get(team);
    const d = divs.get(team);
    if (!qb || !e || !d) throw new Error(`source rows missing for ${team}`);
    const net = Number(e.off_epa) / Number(e.off_plays) - Number(e.def_epa) / Number(e.def_plays);
    return {
      team,
      conf: d.conf as "AFC" | "NFC",
      division: (d.division as string).replace(/^(AFC|NFC) /, ""),
      wins: res.filter((r) => r === "W").length,
      losses: res.filter((r) => r === "L").length,
      ties: res.filter((r) => r === "T").length,
      pf: own.reduce((s, g) => s + g.pf, 0),
      pa: own.reduce((s, g) => s + g.pa, 0),
      net_epa: Math.round(net * 1000) / 1000,
      srs_rank: order.indexOf(team) + 1,
      qb: qb.display_name as string,
      qb_espn_id: qb.espn_id as string,
      result_last: res.at(-1) as "W" | "L" | "T",
    };
  });
}

test("SRS: least-squares ratings reproduce each margin when every game fits exactly", () => {
  // A beats B by 3 and B beats C by 4 at home: A=+10/3, B=+1/3, C=-11/3 (sum 0) fits both exactly.
  const r = srs([
    { home: "A", away: "B", margin: 3 },
    { home: "B", away: "C", margin: 4 },
  ]);
  expect([...r.values()].map((v) => Math.round(v * 3))).toEqual([10, 1, -11]);
});

test("NFL_2024 is the 2024 regular season's own 32 teams, every value re-derived from the source CSVs", () => {
  const derived = derive();
  expect(derived).toHaveLength(32);
  expect(derived.reduce((s, t) => s + t.wins + t.losses + t.ties, 0)).toBe(272 * 2);
  expect(NFL_2024).toEqual(derived);
});
