import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { abs } from "../sources.js";
import {
  NBA_SHOTS,
  NBA_STANDINGS,
  NHL_SHOTS,
  NHL_STANDINGS,
  PWHL_GOALS,
  STANDINGS,
  SUPER_BOWL_LIX_TDS,
} from "../src/data.js";
import { EXAMPLES } from "../src/registry.gen.js";

/** A committed fixture CSV (no quoted fields) as rows of strings. */
function csv(file: string): Record<string, string>[] {
  const [head = "", ...lines] = readFileSync(abs(file), "utf8").trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

/** A committed fixture JSON (a trimmed capture). */
// biome-ignore lint/suspicious/noExplicitAny: captures are untyped JSON
const capture = (file: string): any => JSON.parse(readFileSync(abs(`fixtures/examples/${file}`), "utf8"));

/** Solve `a x = b` by Gaussian elimination with partial pivoting (a is square and non-singular). */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    [m[c], m[p]] = [m[p]!, m[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= m[r]![k]! * x[k]!;
    x[r] = s / m[r]![r]!;
  }
  return x;
}

/**
 * Simple Rating System: the ratings r that best fit r[home] - r[away] = home margin over every game (least squares),
 * with the ratings summing to zero. Normal equations plus the constraint row: (AᵀA + 11ᵀ) r = Aᵀb.
 */
function srs(games: readonly { home: string; away: string; margin: number }[]): Map<string, number> {
  const teams = [...new Set(games.flatMap((g) => [g.home, g.away]))].sort();
  const at = new Map(teams.map((t, i) => [t, i]));
  const n = teams.length;
  const a = teams.map(() => new Array<number>(n).fill(1));
  const b = new Array<number>(n).fill(0);
  for (const g of games) {
    const h = at.get(g.home)!;
    const w = at.get(g.away)!;
    a[h]![h]! += 1;
    a[w]![w]! += 1;
    a[h]![w]! -= 1;
    a[w]![h]! -= 1;
    b[h]! += g.margin;
    b[w]! -= g.margin;
  }
  const r = solve(a, b);
  return new Map(teams.map((t, i) => [t, r[i]!]));
}

/** Every STANDINGS column that comes from data, derived from the committed nflverse fixtures (tools/sample-data). */
function derived() {
  const games = csv("fixtures/examples/nfl_games_2024_reg.csv").map((g) => ({
    week: Number(g.week),
    home: g.home_team!,
    away: g.away_team!,
    hs: Number(g.home_score),
    as: Number(g.away_score),
    hq: g.home_qb_id!,
    aq: g.away_qb_id!,
  }));
  const espn = new Map(csv("fixtures/examples/nfl_qb_espn_ids_2024.csv").map((p) => [p.gsis_id!, p]));
  const epa = new Map(csv("fixtures/examples/nfl_epa_2024_reg.csv").map((e) => [e.team!, e]));
  const ratings = srs(games.map((g) => ({ home: g.home, away: g.away, margin: g.hs - g.as })));
  const order = [...ratings.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
  return (team: string) => {
    const own = games
      .filter((g) => g.home === team || g.away === team)
      .sort((x, y) => x.week - y.week)
      .map((g) => (g.home === team ? { pf: g.hs, pa: g.as, qb: g.hq } : { pf: g.as, pa: g.hs, qb: g.aq }));
    const res = own.map((g) => (g.pf > g.pa ? "W" : g.pf < g.pa ? "L" : "T"));
    const starts = new Map<string, number>();
    for (const g of own) starts.set(g.qb, (starts.get(g.qb) ?? 0) + 1);
    const qb = espn.get([...starts.entries()].sort((x, y) => y[1] - x[1])[0]![0])!;
    const e = epa.get(team)!;
    const net = Number(e.off_epa) / Number(e.off_plays) - Number(e.def_epa) / Number(e.def_plays);
    return {
      wins: res.filter((r) => r === "W").length,
      losses: res.filter((r) => r === "L").length,
      ties: res.filter((r) => r === "T").length,
      pf: own.reduce((s, g) => s + g.pf, 0),
      pa: own.reduce((s, g) => s + g.pa, 0),
      net_epa: Math.round(net * 1000) / 1000,
      srs_rank: order.indexOf(team) + 1,
      qb: qb.display_name,
      qb_espn_id: qb.espn_id,
      result_last: res.at(-1),
    };
  };
}

test("SRS: the least-squares ratings reproduce each margin when every game fits exactly", () => {
  // A beats B by 3 and B beats C by 4 at home: A=+10/3, B=+1/3, C=-11/3 (sum 0) fits both exactly.
  const r = srs([
    { home: "A", away: "B", margin: 3 },
    { home: "B", away: "C", margin: 4 },
  ]);
  expect([...r.values()].map((v) => Math.round(v * 3))).toEqual([10, 1, -11]);
});

test("every STANDINGS value is the 2024 regular season's own (nflverse games, players and play-by-play)", () => {
  const of = derived();
  for (const s of STANDINGS) {
    const d = of(s.team);
    // New England's net EPA is blanked on purpose (the sample-data page says so), so tables show a missing value.
    if (s.team === "NE") {
      expect(s.net_epa).toBeNull();
      expect(d.net_epa).not.toBeNull();
    }
    expect({ ...s, ...(s.team === "NE" ? { net_epa: d.net_epa } : {}) }, s.team).toMatchObject(d);
  }
});

test("the NBA shots are the captured stats.nba.com rows, unchanged", () => {
  const body = JSON.parse(
    readFileSync(abs("fixtures/examples/nba_shotchartdetail_0022300061_q4.json"), "utf8"),
  );
  const set = body.resultSets[0] as { headers: string[]; rowSet: unknown[][] };
  const col = (r: unknown[], name: string) => r[set.headers.indexOf(name)];
  const abbr: Record<string, string> = { "Denver Nuggets": "DEN", "Los Angeles Lakers": "LAL" };
  expect(set.rowSet.map((r) => [col(r, "HTM"), col(r, "VTM")])).toEqual(set.rowSet.map(() => ["DEN", "LAL"]));
  expect(NBA_SHOTS).toEqual(
    set.rowSet.map((r) => ({
      game_event_id: col(r, "GAME_EVENT_ID"),
      player: col(r, "PLAYER_NAME"),
      team: abbr[String(col(r, "TEAM_NAME"))],
      shot_type: col(r, "SHOT_TYPE"),
      made: col(r, "SHOT_MADE_FLAG") === 1,
      x_legacy: col(r, "LOC_X"),
      y_legacy: col(r, "LOC_Y"),
    })),
  );
});

test("no example types a shot by hand: every x_legacy/y_legacy pair in example code is a captured row", () => {
  const captured = new Set(NBA_SHOTS.map((s) => `${s.x_legacy},${s.y_legacy}`));
  const typed = EXAMPLES.flatMap((e) =>
    [...e.code.matchAll(/x_legacy:\s*(-?\d+(?:\.\d+)?),\s*y_legacy:\s*(-?\d+(?:\.\d+)?)/g)].map((m) => ({
      id: e.id,
      at: `${m[1]},${m[2]}`,
    })),
  );
  expect(typed.length).toBeGreaterThan(0); // the toSurfaceFrame API example types two
  expect(typed.filter((t) => !captured.has(t.at))).toEqual([]);
});

test("NBA_STANDINGS are the captured stats.nba.com Pacific Division rows, unchanged", () => {
  const body = capture("nba_leaguestandingsv3_2023_24_pacific.json");
  expect(body.parameters).toEqual({ LeagueID: "00", SeasonYear: "2023-24", SeasonType: "Regular Season" });
  const set = body.resultSets[0] as { headers: string[]; rowSet: unknown[][] };
  const col = (r: unknown[], name: string) => r[set.headers.indexOf(name)];
  expect(set.rowSet.map((r) => col(r, "Division"))).toEqual(set.rowSet.map(() => "Pacific"));
  expect(NBA_STANDINGS).toEqual(
    set.rowSet.map((r) => ({
      team_id: col(r, "TeamID"),
      city: col(r, "TeamCity"),
      team: col(r, "TeamName"),
      wins: col(r, "WINS"),
      losses: col(r, "LOSSES"),
      division_rank: col(r, "DivisionRank"),
    })),
  );
});

test("NHL_STANDINGS are the captured NHL api-web Atlantic Division rows, unchanged", () => {
  const rows = capture("nhl_standings_20252026_atlantic.json").standings as Record<string, unknown>[];
  for (const r of rows)
    expect(r, String(r.teamAbbrev)).toMatchObject({ divisionName: "Atlantic", seasonId: 20252026 });
  expect(NHL_STANDINGS).toEqual(
    rows.map((r) => ({
      team: (r.teamAbbrev as { default: string }).default,
      wins: r.wins,
      losses: r.losses,
      ot_losses: r.otLosses,
      points: r.points,
      division_rank: r.divisionSequence,
    })),
  );
});

test("NHL_SHOTS are the captured NHL api-web first-period shots, unchanged", () => {
  const body = capture("nhl_pbp_2023030417_p1_shots.json");
  const abbr = new Map(
    [body.homeTeam, body.awayTeam].map((t: { id: number; abbrev: string }) => [t.id, t.abbrev]),
  );
  expect([body.id, body.homeTeam.abbrev, body.awayTeam.abbrev]).toEqual([2023030417, "FLA", "EDM"]);
  expect(NHL_SHOTS).toEqual(
    body.plays.map(
      (p: {
        eventId: number;
        typeDescKey: string;
        timeInPeriod: string;
        details: Record<string, number>;
      }) => ({
        event_id: p.eventId,
        type: p.typeDescKey,
        time: p.timeInPeriod,
        team: abbr.get(p.details.eventOwnerTeamId!),
        x: p.details.xCoord,
        y: p.details.yCoord,
      }),
    ),
  );
  // what data.ts and the shot map say: that period Florida shot at the -x end, Edmonton at the +x end
  expect(NHL_SHOTS.every((s) => (s.team === "FLA" ? s.x < 0 : s.x > 0))).toBe(true);
});

test("SUPER_BOWL_LIX_TDS are the captured ESPN touchdown plays, unchanged", () => {
  const body = capture("espn_nfl_summary_401671889_offense_tds.json");
  const competitors = body.header.competitions[0].competitors as {
    homeAway: string;
    team: { id: string; abbreviation: string };
  }[];
  expect(competitors.map((c) => [c.homeAway, c.team.abbreviation])).toEqual([
    ["home", "PHI"],
    ["away", "KC"],
  ]);
  const abbr = new Map(competitors.map((c) => [c.team.id, c.team.abbreviation]));
  expect(SUPER_BOWL_LIX_TDS).toEqual(
    body.plays.map(
      (p: {
        id: string;
        period: { number: number };
        clock: { displayValue: string };
        type: { text: string };
        start: { team: { id: string }; yardLine: number };
      }) => ({
        play_id: p.id,
        period: p.period.number,
        clock: p.clock.displayValue,
        type: p.type.text,
        team: abbr.get(p.start.team.id),
        yardline: p.start.yardLine,
      }),
    ),
  );
});

test("PWHL_GOALS are the captured HockeyTech goals, unchanged, on the 600 x 300 canvas", () => {
  type Name = { firstName: string; lastName: string };
  const events = capture("pwhl_pbp_42_shots.json") as {
    event: string;
    details: {
      game_goal_id?: string;
      team?: { abbreviation: string };
      period: { id: string };
      time: string;
      scoredBy?: Name;
      xLocation: number;
      yLocation: number;
    };
  }[];
  expect(PWHL_GOALS).toEqual(
    events
      .filter((e) => e.event === "goal")
      .map(({ details: d }) => ({
        goal_id: d.game_goal_id,
        team: d.team?.abbreviation,
        period: Number(d.period.id),
        time: d.time,
        scorer: `${d.scoredBy?.firstName} ${d.scoredBy?.lastName}`,
        x: d.xLocation,
        y: d.yLocation,
      })),
  );
  // the range sporty/frames/hockeytech quotes: shots reach both nets of a 600 x 300 canvas (on 850 x 400 the far
  // goal line is near x = 803), which is why the example uses hockeytech-b
  const xs = events.map((e) => e.details.xLocation);
  const ys = events.map((e) => e.details.yLocation);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([31, 573, 11, 292]);
});
