// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { STANDINGS } from "../../sdvtables/test/fixtures/standings.js";
import type { Row } from "../src/_web.js";
import { InputError } from "../src/errors.js";
import { HEADSHOT_ASPECT, headshotUrl } from "../src/headshots.js";
import { getLeagueSync } from "../src/index-data.js";
import {
  contrast,
  loadLeague,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import { teamColorPalette as rechartsPalette } from "../src/recharts.js";
import {
  type TanstackImageDot,
  drawnMarks,
  headshotDots,
  logoDots,
  teamColorPalette,
  teamColorScale,
  withPatterns,
  wordmarkDots,
} from "../src/tanstack.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import { ROWS, ROWS_UNKNOWN } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

const ID = (t: string) => resolveSync(t, "nfl") as string;
const URL_OF = (t: string, o = {}) => logoUrlSync(t, "nfl", o) as string;
const BASE = { x: "x", y: "y", team: "team", league: "nfl" } as const;
/** What `fn` warned, in order. */
function warnings(fn: () => void): string[] {
  const spy = vi.fn();
  setWarningHandler(spy);
  try {
    fn();
  } finally {
    setWarningHandler(null);
  }
  return spy.mock.calls.map((c) => String(c[0]));
}
/** A stand-in for TanStack's renderChartSvg: an svg with one dot per fill given. */
const fake =
  (...fills: string[]) =>
  (_scene: unknown, _o: { idPrefix?: string }) =>
    `<svg class="ts-chart">${fills.map((f) => `<circle fill="${f}"/>`).join("")}</svg>`;

describe("logoDots / wordmarkDots / headshotDots", () => {
  test("one dot mark per logo, its rows in order (the whole row kept), the logo inscribed in the dot", () => {
    const rows = [...ROWS, { x: 30, y: 1, team: "KC" }];
    const dots = logoDots(rows, BASE);
    expect(dots).toHaveLength(2); // KC twice, BUF once
    const [kc, buf] = dots;
    expect(kc?.data).toEqual([
      { x: 10, y: -3, team: "KC", sdv_id: ID("KC"), sdv_src: URL_OF("KC"), sdv_height: 24, sdv_key: "0" },
      { x: 30, y: 1, team: "KC", sdv_id: ID("KC"), sdv_src: URL_OF("KC"), sdv_height: 24, sdv_key: "2" },
    ]);
    expect(buf?.data.map((d) => [d.team, d.sdv_key])).toEqual([["BUF", "1"]]);
    // a square logo 24 px tall: the dot's radius is the box's half-diagonal, so the circle never cuts the logo
    expect(kc?.options).toEqual({
      id: expect.stringMatching(/^sdv-logo-[0-9a-z]+$/),
      x: "x",
      y: "y",
      key: expect.any(Function),
      r: 12 * Math.SQRT2,
      fill: `url(#${kc?.options.id})`,
      fillOpacity: 1,
    });
    expect(kc?.data.map((d) => kc.options.key(d))).toEqual(["0", "2"]); // each dot keyed by its row
    expect(kc?.options.id).not.toBe(buf?.options.id);
    // the pattern is in the dot's bounding box (2r square): the logo is 24 px of it, centred
    const p = kc?.pattern;
    expect(p?.href).toBe(URL_OF("KC"));
    expect((p?.height ?? 0) * 2 * (kc?.options.r ?? 0)).toBeCloseTo(24, 9);
    expect((p?.width ?? 0) * 2 * (kc?.options.r ?? 0)).toBeCloseTo(24, 9);
    expect(p?.x).toBeCloseTo((1 - (p?.width ?? 0)) / 2, 12);
    expect(p?.y).toBeCloseTo((1 - (p?.height ?? 0)) / 2, 12);
    expect(drawnMarks(dots)).toEqual([
      [ID("KC"), 10, -3, 24, URL_OF("KC")],
      [ID("KC"), 30, 1, 24, URL_OF("KC")],
      [ID("BUF"), 20, -7, 24, URL_OF("BUF")],
    ]);
    // the same image gets the same id on every call: a stable mark id and pattern id across updates
    expect(logoDots([{ x: 0, y: 0, team: "KC" }], BASE)[0]?.options.id).toBe(kc?.options.id);
  });

  test("numeric ESPN ids draw their team's logo, as abbreviations do", () => {
    const espn = logoDots(
      [
        { x: 1, y: 2, team: 12 },
        { x: 3, y: 4, team: 24 },
      ],
      BASE,
    );
    const abbr = logoDots(
      [
        { x: 1, y: 2, team: "KC" },
        { x: 3, y: 4, team: "LAC" },
      ],
      BASE,
    );
    expect(drawnMarks(espn)).toEqual(drawnMarks(abbr));
    expect(espn[0]?.data[0]?.team).toBe(12); // the row keeps its own value
  });

  test("size is the height in px at the image's aspect: a wordmark's dot is the box's half-diagonal; alpha is the fill opacity", () => {
    const [d] = wordmarkDots([{ x: 1, y: 2, team: "LV" }], { ...BASE, size: 30, alpha: 0.5 });
    const mark = getLeagueSync("nfl").marks.find((r) => r.archive_url === d?.pattern.href);
    const a = (mark?.width ?? 0) / (mark?.height ?? 1);
    expect(a).toBeGreaterThan(1.5); // a wordmark is wide
    expect(d?.pattern.href).toBe(URL_OF("LV", { markType: "wordmark" }));
    expect(d?.options.r).toBeCloseTo(15 * Math.hypot(1, a), 9);
    const box = 2 * (d?.options.r ?? 0);
    expect((d?.pattern.width ?? 0) * box).toBeCloseTo(30 * a, 9);
    expect((d?.pattern.height ?? 0) * box).toBeCloseTo(30, 9);
    expect(d?.options.fillOpacity).toBe(0.5);
    expect(d?.options.id).toMatch(/^sdv-wordmark-/);
  });

  test("a fraction, zero or NaN for size throws InputError; alpha outside [0, 1] too", () => {
    for (const size of [0.1, 0, -4, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => logoDots(ROWS, { ...BASE, size })).toThrow(InputError);
    expect(() => logoDots(ROWS, { ...BASE, size: 0.1 })).toThrow(/px, not a fraction/);
    for (const alpha of [-0.1, 1.1]) expect(() => logoDots(ROWS, { ...BASE, alpha })).toThrow(InputError);
  });

  test("an unknown team draws nothing and warns once; the rest keep their own x and y", () => {
    let dots: TanstackImageDot<object>[] = [];
    const w = warnings(() => {
      dots = logoDots(ROWS_UNKNOWN, BASE);
    });
    expect(drawnMarks(dots)).toEqual([[ID("KC"), 20, -7, 24, URL_OF("KC")]]);
    expect(w).toHaveLength(1);
  });

  test("a team with colours but no archived logo draws nothing (no broken image) and warns once", async () => {
    await loadLeague("ncaa_whockey");
    // Delaware is in the NCAA women's hockey index with colours but no archived logo
    expect(getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr === "DEL")).toBeDefined();
    expect(teamColorsSync("ncaa_whockey", ["DEL"])[0]).toBeDefined();
    const other = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr !== "DEL")?.team_id as string;
    const rows = [
      { x: 1, y: 1, team: other },
      { x: 2, y: 2, team: "DEL" },
    ];
    let dots: TanstackImageDot<object>[] = [];
    const w = warnings(() => {
      dots = logoDots(rows, { ...BASE, league: "ncaa_whockey" });
      logoDots(rows, { ...BASE, league: "ncaa_whockey" }); // a re-render does not warn again
    });
    expect(drawnMarks(dots).map((d) => d[0])).toEqual([other]);
    expect(dots.every((d) => d.pattern.href !== "")).toBe(true);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/no logo archived: DEL/);
  });

  test("a missing x or y skips that row with one warning; season by row field; embed swaps in a data URI", () => {
    const rows = [
      { x: 1, y: null, team: "KC", yr: 2024 },
      { x: 2, y: 5, team: "LV", yr: 2019 },
    ];
    const embed = new Map([
      [logoUrlSync("LV", "nfl", { season: 2019 }) as string, "data:image/png;base64,AA=="],
    ]);
    let dots: TanstackImageDot<object>[] = [];
    const w = warnings(() => {
      dots = logoDots(rows, { ...BASE, season: "yr", embed });
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/missing x or y/);
    expect(drawnMarks(dots)).toEqual([[ID("LV"), 2, 5, 24, "data:image/png;base64,AA=="]]);
    // @ts-expect-error: not a field of the rows, which the types catch too
    expect(() => logoDots(rows, { ...BASE, x: "nope" })).toThrow(/x column "nope"/);
  });

  test("headshots: ESPN ids at the headshot aspect; an id with no headshot warns once", () => {
    const rows = [
      { x: 1, y: 2, id: "3139477" },
      { x: 3, y: 4, id: "nope" },
    ];
    let dots: TanstackImageDot<object>[] = [];
    const w = warnings(() => {
      dots = headshotDots(rows, { x: "x", y: "y", player: "id", league: "nfl", size: 40 });
    });
    expect(drawnMarks(dots)).toEqual([["3139477", 1, 2, 40, headshotUrl("3139477", "nfl")]]);
    expect(dots[0]?.options.r).toBeCloseTo(20 * Math.hypot(1, HEADSHOT_ASPECT), 9);
    expect(dots[0]?.options.id).toMatch(/^sdv-headshot-/);
    expect(w).toHaveLength(1);
  });

  test("`id` names the marks, so a chart can draw the same logos twice; drawnMarks reads several sets", () => {
    const a = logoDots(ROWS, BASE);
    const b = logoDots(ROWS, { ...BASE, id: "end" });
    expect(b.map((d) => d.options.id.startsWith("end-"))).toEqual([true, true]);
    expect(b[0]?.options.fill).toBe(`url(#${b[0]?.options.id})`);
    expect(drawnMarks(a, b)).toHaveLength(4);
    // it becomes an SVG id and a url(#...) fill, which TanStack escapes: a character that needs escaping is refused,
    // not left as a fill that names no pattern
    for (const id of ["a&b", "a<b", "a>b", 'a"b', "a)b", "a b", ""])
      expect(() => logoDots(ROWS, { ...BASE, id })).toThrow(InputError);
    expect(() => logoDots(ROWS, { ...BASE, id: "end_2-x" })).not.toThrow();
    expect(drawnMarks()).toEqual([]);
  });

  test("the input rows are left as they were", () => {
    const rows: Row[] = STANDINGS.filter((r) => r.division === "West").map((r) => ({ ...r }));
    const before = JSON.stringify(rows);
    for (const r of rows) Object.freeze(r);
    logoDots(Object.freeze(rows), { x: "pf", y: "pa", team: "team", league: "nfl" });
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("withPatterns", () => {
  const dots = logoDots(ROWS, BASE);
  const [kc, buf] = dots;
  const kcId = kc?.options.id as string;

  test("writes each dot's pattern into the chart's svg and scopes the ids by idPrefix, as TanStack scopes gradients", () => {
    const render = withPatterns(fake(`url(#${kcId})`, "url(#their-gradient)", "#ff0000"), dots);
    // TanStack strips everything but [A-Za-z0-9_-] from the prefix (React's useId gives ":r1:")
    const svg = render({}, { idPrefix: ":r1:" });
    expect(svg).toContain(`<circle fill="url(#r1-${kcId})"/>`);
    expect(svg).toContain('<circle fill="url(#their-gradient)"/>'); // not sdvplot's: left alone
    expect(svg).toMatch(/<\/defs><\/svg>$/);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const patterns = [...doc.querySelectorAll("defs[data-ts-key='sdv-patterns'] > pattern")];
    expect(patterns.map((p) => p.getAttribute("id"))).toEqual([`r1-${kcId}`, `r1-${buf?.options.id}`]);
    const image = patterns[0]?.querySelector("image");
    expect(image?.getAttribute("href")).toBe(URL_OF("KC"));
    expect(patterns[0]?.getAttribute("patternContentUnits")).toBe("objectBoundingBox");
    expect(Number(image?.getAttribute("width"))).toBeCloseTo(kc?.pattern.width ?? 0, 4);
    // no prefix: the ids as they are
    expect(render({}, {})).toContain(`<circle fill="url(#${kcId})"/>`);
    expect(render({}, {})).toContain(`id="${kcId}"`);
  });

  test("escapes the href; no dots leaves the markup alone; a serializer with no </svg> is an error", () => {
    const [d] = logoDots([{ x: 1, y: 1, team: "KC" }], {
      ...BASE,
      embed: new Map([[URL_OF("KC"), 'data:image/svg+xml,<svg a="1">']]),
    });
    const svg = withPatterns(fake(), [d as NonNullable<typeof d>])({}, {});
    expect(svg).toContain('href="data:image/svg+xml,&#60;svg a=&#34;1&#34;&#62;"');
    expect(withPatterns(fake("x"))({}, {})).toBe(fake("x")({}, {}));
    expect(() => withPatterns(() => "<g/>", dots)({}, {})).toThrow(/no <\/svg>/);
  });
});

describe("teamColorScale / teamColorPalette", () => {
  test("TanStack's color option: the teams as the data holds them, once each, and their colours", async () => {
    await loadLeague("nfl");
    const s = teamColorScale("nfl", ["KC", "LV", "KC", 12]);
    expect(s.domain).toEqual(["KC", "LV", 12]);
    expect(s.range).toEqual(teamColorPalette("nfl", ["KC", "LV", 12]));
    expect(s.range[0]).toBe(s.range[2]); // 12 is KC's ESPN id: one team, one colour
    // TanStack keys a value by its type too: 12 and "12" are two keys, both kept, with one colour
    const mixed = teamColorScale("nfl", [12, "12"]);
    expect(mixed.domain).toEqual([12, "12"]);
    expect(mixed.range[0]).toBe(mixed.range[1]);
    expect(teamColorPalette("nfl", ["KC", "LAC"])).toEqual(rechartsPalette("nfl", ["KC", "LAC"]));
    const w = warnings(() => {
      expect(teamColorScale("nfl", ["XXX"], { fallback: "#123456" }).range).toEqual(["#123456"]);
    });
    expect(w).toHaveLength(1); // the resolver's own
  });

  test("dark mode: on a dark card (#111827) every NFL and NBA colour reads (3:1) and pairs stay ΔE 20 apart", async () => {
    for (const lg of ["nfl", "nba"] as const) {
      await loadLeague(lg);
      const teams = getLeagueSync(lg).teams.map((t) => t.team_id);
      let range: string[] = [];
      const w = warnings(() => {
        range = teamColorScale(lg, teams, { background: "#111827", idSystem: "team_id" }).range;
      });
      expect(w).toEqual([]);
      for (const c of range) expect(contrast(c, "#111827")).toBeGreaterThanOrEqual(MIN_CONTRAST);
      for (let i = 0; i < range.length; i++)
        for (let j = i + 1; j < range.length; j++)
          expect(deltaE(range[i] as string, range[j] as string)).toBeGreaterThanOrEqual(MIN_DELTA_E);
    }
    // without the background some NFL colours do not read on it: the gap the option closes
    const plain = teamColorScale("nfl", ["DEN", "LV"]).range;
    expect(plain.some((c) => contrast(c, "#111827") < MIN_CONTRAST)).toBe(true);
  });
});
