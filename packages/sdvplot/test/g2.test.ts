// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { STANDINGS } from "../../sdvtables/test/fixtures/standings.js";
import type { Row } from "../src/_web.js";
import { InputError } from "../src/errors.js";
import {
  axisLogos,
  drawnMarks,
  headshotMark,
  logoMark,
  teamColorPalette,
  teamColorScale,
  wordmarkMark,
} from "../src/g2.js";
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

describe("logoMark / wordmarkMark / headshotMark", () => {
  test("a G2 image mark: one datum per row (the whole row kept), x, y and src encoded by field, out of tooltip and legend", () => {
    const m = logoMark(ROWS, BASE);
    expect(m).toMatchObject({
      type: "image",
      encode: { x: "x", y: "y", src: "sdv_src" },
      style: { opacity: 1 },
      tooltip: false,
      legend: false,
    });
    expect(m.data).toEqual([
      { x: 10, y: -3, team: "KC", sdv_id: ID("KC"), sdv_src: URL_OF("KC"), sdv_width: 24, sdv_height: 24 },
      { x: 20, y: -7, team: "BUF", sdv_id: ID("BUF"), sdv_src: URL_OF("BUF"), sdv_width: 24, sdv_height: 24 },
    ]);
    // the style hands G2 each datum's own size in px
    expect(m.data.map((d) => [m.style.width(d), m.style.height(d)])).toEqual([
      [24, 24],
      [24, 24],
    ]);
    expect(drawnMarks(m)).toEqual([
      [ID("KC"), 10, -3, 24, URL_OF("KC")],
      [ID("BUF"), 20, -7, 24, URL_OF("BUF")],
    ]);
  });

  test("size is the height in px, the width keeps the image's aspect; alpha is the opacity", () => {
    const m = wordmarkMark([{ x: 1, y: 2, team: "LV" }], { ...BASE, size: 30, alpha: 0.5 });
    const [d] = m.data;
    const mark = getLeagueSync("nfl").marks.find((r) => r.archive_url === d?.sdv_src);
    expect(d?.sdv_src).toBe(URL_OF("LV", { markType: "wordmark" }));
    expect(d?.sdv_height).toBe(30);
    expect(d?.sdv_width).toBeCloseTo((30 * (mark?.width ?? 0)) / (mark?.height ?? 1), 9);
    expect(d?.sdv_width).not.toBe(30); // a wordmark is wider than tall
    expect(m.style.opacity).toBe(0.5);
    expect(drawnMarks(m)[0]?.[3]).toBe(30);
  });

  test("a fraction, zero or NaN for size throws InputError; alpha outside [0, 1] too", () => {
    for (const size of [0.1, 0, -4, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => logoMark(ROWS, { ...BASE, size })).toThrow(InputError);
    expect(() => logoMark(ROWS, { ...BASE, size: 0.1 })).toThrow(/px, not a fraction/);
    for (const alpha of [-0.1, 1.1]) expect(() => logoMark(ROWS, { ...BASE, alpha })).toThrow(InputError);
    expect(() => axisLogos({ league: "nfl", size: 0.5 })).toThrow(InputError);
  });

  test("an unknown team draws nothing and warns once; the rest keep their own x and y", () => {
    let m: ReturnType<typeof logoMark> | undefined;
    const w = warnings(() => {
      m = logoMark(ROWS_UNKNOWN, BASE);
    });
    expect(drawnMarks(m)).toEqual([[ID("KC"), 20, -7, 24, URL_OF("KC")]]);
    expect(w).toHaveLength(1);
  });

  test("a team with colours but no archived logo draws nothing (no broken image) and warns once", async () => {
    await loadLeague("ncaa_whockey");
    // Delaware is in the NCAA women's hockey index with colours but no archived logo
    const del = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr === "DEL");
    expect(del).toBeDefined();
    expect(teamColorsSync("ncaa_whockey", ["DEL"])[0]).toBeDefined();
    const other = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr !== "DEL")?.team_id as string;
    const rows = [
      { x: 1, y: 1, team: other },
      { x: 2, y: 2, team: "DEL" },
    ];
    let m: ReturnType<typeof logoMark> | undefined;
    const w = warnings(() => {
      m = logoMark(rows, { ...BASE, league: "ncaa_whockey" });
      logoMark(rows, { ...BASE, league: "ncaa_whockey" }); // a re-render does not warn again
    });
    expect(drawnMarks(m).map((d) => d[0])).toEqual([other]);
    expect(m?.data.every((d) => d.sdv_src !== "")).toBe(true);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/no logo archived: DEL/);
  });

  test("a missing x or y skips that row with one warning; season by row field; embed swaps in a data URI", () => {
    const rows = [
      { x: 1, y: null, team: "KC", yr: 2024 },
      { x: 2, y: 5, team: "LV", yr: 2019 },
    ];
    let m: ReturnType<typeof logoMark> | undefined;
    const embed = new Map([
      [logoUrlSync("LV", "nfl", { season: 2019 }) as string, "data:image/png;base64,AA=="],
    ]);
    const w = warnings(() => {
      m = logoMark(rows, { ...BASE, season: "yr", embed });
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/missing x or y/);
    expect(drawnMarks(m)).toEqual([[ID("LV"), 2, 5, 24, "data:image/png;base64,AA=="]]);
    expect(() => logoMark(rows, { ...BASE, x: "nope" })).toThrow(/x column "nope"/);
  });

  test("headshots: ESPN ids at the headshot aspect; an id with no headshot warns once", () => {
    const rows = [
      { x: 1, y: 2, id: "3139477" },
      { x: 3, y: 4, id: "nope" },
    ];
    let m: ReturnType<typeof headshotMark> | undefined;
    const w = warnings(() => {
      m = headshotMark(rows, { x: "x", y: "y", player: "id", league: "nfl", size: 40 });
    });
    expect(drawnMarks(m)).toEqual([["3139477", 1, 2, 40, headshotUrl("3139477", "nfl")]]);
    expect(m?.data[0]?.sdv_width).toBeCloseTo(40 * HEADSHOT_ASPECT, 9);
    expect(w).toHaveLength(1);
  });

  test("drawnMarks finds the marks in a G2 view's children, an Ant Design Charts config's annotations, or a list", () => {
    const a = logoMark(ROWS, BASE);
    const b = logoMark([{ x: 5, y: 6, team: "LV" }], BASE);
    const spec = {
      type: "spaceFlex",
      children: [
        { type: "view", children: [{ type: "point", data: ROWS }, a] },
        { type: "image", data: [{ src: "x" }], encode: { src: "src" } }, // a user's own image mark: not ours
      ],
    };
    expect(drawnMarks(spec).map((d) => d[0])).toEqual([ID("KC"), ID("BUF")]);
    expect(drawnMarks({ data: ROWS, xField: "x", annotations: [b] }).map((d) => d[0])).toEqual([ID("LV")]);
    expect(drawnMarks([a, b])).toHaveLength(3);
    expect(drawnMarks(null)).toEqual([]);
  });

  test("the input rows are left as they were", () => {
    const rows: Row[] = STANDINGS.filter((r) => r.division === "West").map((r) => ({ ...r }));
    const before = JSON.stringify(rows);
    for (const r of rows) Object.freeze(r);
    logoMark(Object.freeze(rows), { x: "pf", y: "pa", team: "team", league: "nfl" });
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("axisLogos", () => {
  test("G2 band-axis options: an HTML logo per label, sized by inline style, at full opacity, none hidden or rotated", () => {
    const ax = axisLogos({ league: "nfl", size: 28 });
    expect(ax).toMatchObject({
      labelOpacity: 1,
      labelAutoHide: false,
      labelAutoRotate: false,
      transform: [],
    });
    const html = ax.labelRender({ label: "KC" });
    const img = new DOMParser().parseFromString(html, "text/html").body.firstElementChild as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe(URL_OF("KC"));
    expect(img.getAttribute("alt")).toBe("KC logo");
    expect(img.dataset.sdvId).toBe(ID("KC"));
    // G2's parseHeightFromHTML reads the height from the element's own style
    expect(img.style.height).toBe("28px");
    expect(img.style.width).toBe("28px");
    expect(img.style.marginLeft).toBe("-14px"); // centred on the box's left edge, where G2 puts the tick
  });

  test("a category with no logo keeps its text, HTML-escaped, and warns once over every render", () => {
    const ax = axisLogos({ league: "nfl" });
    const w = warnings(() => {
      for (let i = 0; i < 3; i++) ax.labelRender({ label: "<b>XXX</b>" });
    });
    const html = ax.labelRender({ label: "<b>XXX</b>" });
    expect(html).not.toContain("<b>");
    const el = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
    expect(el?.tagName).toBe("SPAN");
    expect(el?.textContent).toBe("<b>XXX</b>");
    expect(w).toHaveLength(1);
  });

  test("wordmarks keep their aspect; embed inlines the image", () => {
    const url = URL_OF("LV", { markType: "wordmark" });
    const html = axisLogos({
      league: "nfl",
      markType: "wordmark",
      embed: new Map([[url, "data:x"]]),
    }).labelRender({
      label: "LV",
    });
    const img = new DOMParser().parseFromString(html, "text/html").body.firstElementChild as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("data:x");
    expect(img.alt).toBe("LV wordmark");
    expect(Number.parseFloat(img.style.width)).toBeGreaterThan(24);
  });
});

describe("teamColorPalette / teamColorScale", () => {
  const AFC_WEST = ["KC", "LAC", "DEN", "LV"];
  test("the palette is the shared one (as recharts'), the scale its ordinal domain and range", () => {
    for (const o of [{}, { background: "#141414" }]) {
      expect(teamColorPalette("nfl", AFC_WEST, o)).toEqual(rechartsPalette("nfl", AFC_WEST, o));
      expect(teamColorScale("nfl", AFC_WEST, o)).toEqual({
        type: "ordinal",
        domain: AFC_WEST,
        range: teamColorPalette("nfl", AFC_WEST, o),
      });
    }
    // each team once, exactly as the data holds it (a number stays a number: G2 matches by exact value), in order;
    // 12 and "12" are one team, the first kept
    const mixed = teamColorScale("nfl", ["KC", "LV", "KC", 12, "12"]);
    expect(mixed.domain).toEqual(["KC", "LV", 12]);
    expect(mixed.range).toEqual(teamColorPalette("nfl", ["KC", "LV", "12"]));
    const w = warnings(() => {
      expect(teamColorScale("nfl", ["XXX"], { fallback: "#123456" }).range).toEqual(["#123456"]);
    });
    expect(w).toHaveLength(1); // the resolver's own
  });

  test("dark mode: on G2's dark theme (#141414) every NFL and NBA colour reads (3:1) and pairs stay ΔE 20 apart", async () => {
    for (const lg of ["nfl", "nba"] as const) {
      await loadLeague(lg);
      const teams = getLeagueSync(lg).teams.map((t) => t.team_id);
      let range: string[] = [];
      const w = warnings(() => {
        range = teamColorScale(lg, teams, { background: "#141414", idSystem: "team_id" }).range;
      });
      expect(w).toEqual([]);
      for (const c of range) expect(contrast(c, "#141414")).toBeGreaterThanOrEqual(MIN_CONTRAST);
      for (let i = 0; i < range.length; i++)
        for (let j = i + 1; j < range.length; j++)
          expect(deltaE(range[i] as string, range[j] as string)).toBeGreaterThanOrEqual(MIN_DELTA_E);
    }
    // without the background some NFL colours do not read on it: the gap the option closes
    const plain = teamColorScale("nfl", ["DEN", "LV"]).range;
    expect(plain.some((c) => contrast(c, "#141414") < MIN_CONTRAST)).toBe(true);
  });
});
