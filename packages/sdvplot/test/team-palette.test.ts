import { beforeEach, describe, expect, test } from "vitest";
import { contrast, hex6 } from "../src/contrast.js";
import { getLeagueSync, loadLeague } from "../src/index-data.js";
import { type League, resetWarnings, setWarningHandler } from "../src/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE, readable, teamPalette } from "../src/team-palette.js";

beforeEach(() => resetWarnings());

const LEAGUES = ["nba", "nfl", "mlb", "nhl"] as const;
const BACKGROUNDS = ["#181a1b", "#000000", "#ffffff"];
/** A league's teams in the league's standard (shard) order: abbreviations, brand colours and other colours. */
async function league(lg: League, only?: readonly string[]) {
  await loadLeague(lg);
  const all = getLeagueSync(lg).teams;
  const teams = only === undefined ? all : only.map((a) => all.find((t) => t.abbr === a) ?? expect.fail(a));
  return {
    labels: teams.map((t) => t.abbr ?? t.team_id),
    main: teams.map((t) => hex6(t.color_primary ?? "#808080", { dropAlpha: true })),
    alt: teams.map((t) => t.color_secondary ?? null),
  };
}
function warnings<T>(f: () => T): { out: T; seen: string[] } {
  const seen: string[] = [];
  setWarningHandler((m) => seen.push(m));
  try {
    return { out: f(), seen };
  } finally {
    setWarningHandler(null);
  }
}
/** Every pair of `out` closer than the threshold, by label. */
const tooClose = (out: readonly string[], labels: readonly string[]): string[] =>
  out.flatMap((c, i) =>
    out.slice(0, i).flatMap((p, j) => (deltaE(c, p) < MIN_DELTA_E ? [`${labels[j]}/${labels[i]}`] : [])),
  );

describe("deltaE", () => {
  test("is CIE76: 0 for one colour, 100 from black to white, symmetric", () => {
    expect(deltaE("#fdb927", "#fdb927")).toBe(0);
    expect(deltaE("#000000", "#ffffff")).toBeCloseTo(100, 1);
    expect(deltaE("#552583", "#fdb927")).toBeCloseTo(deltaE("#fdb927", "#552583"), 10);
  });
});

describe("teamPalette", () => {
  test.each(LEAGUES.flatMap((lg) => BACKGROUNDS.map((bg) => [lg, bg] as const)))(
    "%s in league order on %s: no warning, every colour at 3:1, every pair at least MIN_DELTA_E apart",
    async (lg, bg) => {
      const { labels, main, alt } = await league(lg);
      const { out, seen } = warnings(() => teamPalette(main, alt, bg, labels));
      expect(seen).toEqual([]);
      expect(out).toHaveLength(main.length);
      for (const c of out) expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(tooClose(out, labels)).toEqual([]);
      // a colour already readable and distinct from the teams before it is kept exactly
      main.forEach((c, i) => {
        const keep =
          contrast(c, bg) >= MIN_CONTRAST && out.slice(0, i).every((p) => deltaE(c, p) >= MIN_DELTA_E);
        if (keep) expect(out[i], labels[i]).toBe(c);
      });
      // deterministic: the same colours give the same palette
      expect(teamPalette(main, alt, bg, labels)).toEqual(out);
    },
  );

  test("the Lakers and the Warriors on #181a1b no longer share one gold", async () => {
    const { labels, main, alt } = await league("nba", ["LAL", "GS"]);
    // the contrast fix alone gives both the same colour
    expect(readable(main[0] as string, alt[0], "#181a1b")).toBe(
      readable(main[1] as string, alt[1], "#181a1b"),
    );
    const out = teamPalette(main, alt, "#181a1b", labels);
    expect(tooClose(out, labels)).toEqual([]);
  });

  test("the White Sox and the Yankees (both silver on dark) and the White Sox and Pittsburgh (both black on white)", async () => {
    const nyy = await league("mlb", ["NYY", "CHW"]);
    expect(readable(nyy.main[0] as string, nyy.alt[0], "#181a1b")).toBe(
      readable(nyy.main[1] as string, nyy.alt[1], "#181a1b"),
    ); // identical without the distinctness pass: one invisible line
    const pit = await league("mlb", ["PIT", "CHW"]);
    expect(pit.main[0]).toBe(pit.main[1]); // the same brand black
    for (const [{ labels, main, alt }, bg] of [
      [nyy, "#181a1b"],
      [pit, "#ffffff"],
    ] as const) {
      const { out, seen } = warnings(() => teamPalette(main, alt, bg, labels));
      expect(seen).toEqual([]);
      expect(tooClose(out, labels)).toEqual([]);
      for (const c of out) expect(contrast(c, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  test("the last resort: when no readable colour is left it keeps the readable one and warns once per pair", () => {
    // on a mid grey only near-black and near-white reach 3:1, room for a few colours MIN_DELTA_E apart, not thirty
    const greys = Array.from({ length: 30 }, () => "#777777");
    const labels = greys.map((_, i) => `T${i + 1}`);
    const { out, seen } = warnings(() => teamPalette(greys, [], "#777777", labels));
    for (const c of out) expect(contrast(c, "#777777")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.length).toBe(new Set(seen).size);
    expect(seen[0]).toMatch(new RegExp(`stays within ΔE ${MIN_DELTA_E} of`));
    expect(tooClose(out, labels).length).toBeGreaterThan(0); // the warned teams are the ones left too close
    expect(teamPalette(greys, [], "#777777", labels)).toEqual(out); // deterministic
    expect(warnings(() => teamPalette(greys, [], "#777777", labels)).seen).toEqual([]); // and not again
  });
});
