import { beforeEach, describe, expect, test } from "vitest";
import { contrast, hex6 } from "../src/contrast.js";
import { loadLeague, resetWarnings, setWarningHandler, teamColorsSync } from "../src/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE, readable, teamPalette } from "../src/team-palette.js";

beforeEach(() => resetWarnings());

// biome-ignore format: the 30 teams, one line
const NBA = [
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS", "HOU", "IND", "LAC", "LAL", "MEM",
  "MIA", "MIL", "MIN", "NO", "NY", "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH",
];
const BACKGROUNDS = ["#181a1b", "#000000", "#ffffff"];
async function nba(teams: readonly string[]): Promise<{ main: string[]; alt: (string | null)[] }> {
  await loadLeague("nba");
  const main = (teamColorsSync("nba", teams) as (string | null)[]).map((c) =>
    hex6(c ?? "#808080", { dropAlpha: true }),
  );
  const alt = (teamColorsSync("nba", teams, { which: "secondary" }) as (string | null)[]).map(
    (c) => c ?? null,
  );
  return { main, alt };
}
function warnings(f: () => string[]): { out: string[]; seen: string[] } {
  const seen: string[] = [];
  setWarningHandler((m) => seen.push(m));
  try {
    return { out: f(), seen };
  } finally {
    setWarningHandler(null);
  }
}

describe("deltaE", () => {
  test("is CIE76: 0 for one colour, 100 from black to white, symmetric", () => {
    expect(deltaE("#fdb927", "#fdb927")).toBe(0);
    expect(deltaE("#000000", "#ffffff")).toBeCloseTo(100, 1);
    expect(deltaE("#552583", "#fdb927")).toBeCloseTo(deltaE("#fdb927", "#552583"), 10);
  });
});

describe("teamPalette", () => {
  test("the Lakers and the Warriors on #181a1b no longer share one gold", async () => {
    const { main, alt } = await nba(["LAL", "GS"]);
    // the contrast fix alone gives both the same colour: the readable-only result the ruling rejected
    expect(readable(main[0] as string, alt[0], "#181a1b")).toBe(
      readable(main[1] as string, alt[1], "#181a1b"),
    );
    const [lal, gs] = teamPalette(main, alt, "#181a1b", ["LAL", "GS"]) as [string, string];
    expect(deltaE(lal, gs)).toBeGreaterThanOrEqual(MIN_DELTA_E);
    for (const c of [lal, gs]) expect(contrast(c, "#181a1b")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("all 30 NBA teams on each background: every colour at 3:1, no two within the threshold, no warning", async () => {
    const { main, alt } = await nba(NBA);
    for (const bg of BACKGROUNDS) {
      resetWarnings();
      const { out, seen } = warnings(() => teamPalette(main, alt, bg, NBA));
      expect(seen, bg).toEqual([]); // measured: the fallback never fires for the NBA on these three backgrounds
      expect(out).toHaveLength(30);
      for (const c of out) expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      for (let i = 0; i < out.length; i++)
        for (let j = 0; j < i; j++)
          expect(
            deltaE(out[i] as string, out[j] as string),
            `${NBA[j]} / ${NBA[i]} on ${bg}`,
          ).toBeGreaterThanOrEqual(MIN_DELTA_E);
    }
  });

  test("a colour already readable and distinct from the teams before it is kept exactly", async () => {
    const { main, alt } = await nba(NBA);
    for (const bg of BACKGROUNDS) {
      const out = teamPalette(main, alt, bg, NBA);
      let kept = 0;
      main.forEach((c, i) => {
        const ok =
          contrast(c, bg) >= MIN_CONTRAST && out.slice(0, i).every((p) => deltaE(c, p) >= MIN_DELTA_E);
        if (!ok) return;
        expect(out[i], `${NBA[i]} on ${bg}`).toBe(c);
        kept++;
      });
      expect(kept, bg).toBeGreaterThanOrEqual(5); // the rule is exercised, not vacuous
    }
  });

  test("deterministic, and the last resort keeps the readable colour with one warning", () => {
    // twelve teams of one grey with no other colour: lightness alone has room for about six, so the steps run out
    const greys = Array.from({ length: 12 }, () => "#777777");
    const labels = greys.map((_, i) => String.fromCharCode(65 + i));
    const { out, seen } = warnings(() => teamPalette(greys, [], "#ffffff", labels));
    expect(teamPalette(greys.slice(0, 2), [], "#ffffff")).toEqual(out.slice(0, 2));
    for (const c of out) expect(contrast(c, "#ffffff")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(new Set(out).size).toBeLessThan(out.length); // some team could not be separated
    expect(seen.length).toBe(new Set(seen).size); // one warning per clashing pair
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toMatch(/stays within ΔE 10 of/);
    // the same clash again does not warn again
    const again = warnings(() => teamPalette(greys, [], "#ffffff", labels));
    expect(again.seen).toEqual([]);
  });
});
