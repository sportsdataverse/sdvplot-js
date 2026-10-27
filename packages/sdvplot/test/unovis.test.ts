// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HEADSHOT_ASPECT, headshotUrl } from "../src/headshots.js";
import { getLeagueSync } from "../src/index-data.js";
import {
  contrast,
  loadLeague,
  logoUrlSync,
  resetWarnings,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import { teamColorPalette as rechartsPalette } from "../src/recharts.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import { headshotIcons, logoIcons, teamColorPalette, teamColorScale } from "../src/unovis.js";
import "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

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
/** The symbols of an icon set's svgDefs, parsed: id, viewBox, and its image's href and size. */
function symbols(svgDefs: string) {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgDefs}</svg>`,
    "image/svg+xml",
  );
  return [...doc.querySelectorAll("symbol")].map((s) => {
    const img = s.querySelector("image");
    return {
      id: s.id,
      viewBox: s.getAttribute("viewBox"),
      href: img?.getAttribute("href"),
      width: img?.getAttribute("width"),
      height: img?.getAttribute("height"),
    };
  });
}

describe("teamColorScale / teamColorPalette", () => {
  test("each team's primary colour, the shared palette; numeric ESPN ids, strings and abbreviations are one team", () => {
    const color = teamColorScale("nfl", ["KC", 21, "21", "BUF", "KC"]);
    // the domain as the data holds it: 21 and "21" both kept, "KC" once
    expect(color.domain).toEqual(["KC", 21, "21", "BUF"]);
    const [kc, phi, buf] = teamColorsSync("nfl", ["KC", "PHI", "BUF"]) as string[];
    expect(color.range).toEqual([kc, phi, phi, buf]);
    // the accessor answers for any value naming a domain team, of either type
    expect([color("KC"), color(12), color("12"), color(21), color("PHI"), color("BUF")]).toEqual([
      kc,
      kc,
      kc,
      phi,
      phi,
      buf,
    ]);
    expect(teamColorPalette("nfl", ["KC", "PHI", "BUF"])).toEqual(
      rechartsPalette("nfl", ["KC", "PHI", "BUF"]),
    );
  });

  test("which, season, idSystem and fallback; a value outside the domain is the fallback, with one warning", () => {
    const sec = teamColorsSync("nfl", ["KC"], { which: "secondary" })[0];
    expect(teamColorScale("nfl", ["KC"], { which: "secondary" })("KC")).toBe(sec);
    // OAK only resolves in a Raiders season there
    expect(teamColorScale("nfl", ["OAK"], { season: 2019 }).range).toEqual(
      teamColorsSync("nfl", ["OAK"], { season: 2019 }),
    );
    expect(teamColorScale("nfl", [12], { idSystem: "team_id" }).range).toEqual(teamColorsSync("nfl", ["KC"]));
    const color = teamColorScale("nfl", ["KC"], { fallback: "#123456" });
    const w = warnings(() => {
      expect(color("BUF")).toBe("#123456");
      expect(color("BUF")).toBe("#123456"); // a re-render does not warn again
    });
    expect(w).toEqual(['teamColorScale: "BUF" is not one of its teams; drawn in #123456']);
    let range: readonly string[] = [];
    const u = warnings(() => {
      range = teamColorScale("nfl", ["XXX", "KC"], { fallback: "#123456" }).range;
    });
    expect(range).toEqual(["#123456", teamColorsSync("nfl", ["KC"])[0]]);
    expect(u).toHaveLength(1); // the resolver's own
  });

  test("dark mode: on a stated background (#111827) every NFL and NBA team reads at 3:1, pairs stay ΔE 20 apart, a numeric id keeps its team's colour", async () => {
    for (const lg of ["nfl", "nba"] as const) {
      await loadLeague(lg);
      const teams = getLeagueSync(lg).teams.map((t) => t.team_id);
      let range: readonly string[] = [];
      const w = warnings(() => {
        range = teamColorScale(lg, teams, { background: "#111827", idSystem: "team_id" }).range;
      });
      expect(w).toEqual([]);
      for (const c of range) expect(contrast(c, "#111827")).toBeGreaterThanOrEqual(MIN_CONTRAST);
      for (let i = 0; i < range.length; i++)
        for (let j = i + 1; j < range.length; j++)
          expect(deltaE(range[i] as string, range[j] as string)).toBeGreaterThanOrEqual(MIN_DELTA_E);
    }
    // the Eagles' midnight green does not read on it; on it, 21 and "PHI" take one adjusted colour
    const plain = teamColorsSync("nfl", ["PHI"])[0] as string;
    expect(contrast(plain, "#111827")).toBeLessThan(MIN_CONTRAST);
    const dark = teamColorScale("nfl", [12, 21], { background: "#111827" });
    expect(dark.range).toEqual(rechartsPalette("nfl", ["KC", "PHI"], { background: "#111827" }));
    expect(dark("PHI")).toBe(dark(21));
    expect(dark(21)).not.toBe(plain);
  });

  test("teamColorPalette resolves aliases as teamColorScale does: on a background, 'KC' and 12 are one team, one colour", () => {
    const o = { background: "#111827" };
    const pal = teamColorPalette("nfl", ["KC", 12, "PHI"], o);
    const scale = teamColorScale("nfl", ["KC", 12, "PHI"], o);
    expect(pal[0]).toBe(pal[1]);
    expect(pal).toEqual([scale("KC"), scale(12), scale("PHI")]);
  });
});

describe("logoIcons / headshotIcons", () => {
  test("one symbol per logo, each a node icon href; numeric and string ids find the same logo; repeats once", () => {
    const logos = logoIcons("nfl", ["KC", 21, "BUF", "KC", "21"]);
    expect(logos.domain).toEqual(["KC", 21, "BUF", "21"]);
    const defs = symbols(logos.svgDefs);
    // three logos, in order; the URL is sdvplot's logo for each team
    expect(defs.map((s) => s.href)).toEqual(["KC", "PHI", "BUF"].map((t) => logoUrlSync(t, "nfl") as string));
    const ids = defs.map((s) => `#${s.id}`);
    expect(logos.range).toEqual([ids[0], ids[1], ids[2], ids[1]]);
    expect([logos("KC"), logos(12), logos("12"), logos(21), logos("PHI"), logos("BUF")]).toEqual([
      ids[0],
      ids[0],
      ids[0],
      ids[1],
      ids[1],
      ids[2],
    ]);
    // each symbol's box is its logo's own aspect, so a <use> of it fits the logo uncut
    for (const s of defs) {
      expect(s.height).toBe("100");
      expect(s.viewBox).toBe(`0 0 ${s.width} 100`);
    }
    // the ids are a function of the image: a second set (another chart) shares them
    expect(logoIcons("nfl", ["BUF"]).range).toEqual([ids[2]]);
    // the dark variant is another image, so another symbol
    const dark = logoIcons("nfl", ["LV"], { variant: "dark" });
    expect(symbols(dark.svgDefs)[0]?.href).toBe(logoUrlSync("LV", "nfl", { variant: "dark" }));
    expect(dark("LV")).not.toBe(logoIcons("nfl", ["LV"])("LV"));
    // a value with no logo, or none given, has no icon
    expect(logos("LV")).toBeUndefined();
    expect(logos(null)).toBeUndefined();
  });

  test("a team with colours but no archived logo has no icon (no broken image) and warns once", async () => {
    await loadLeague("ncaa_whockey");
    // Delaware is in the NCAA women's hockey index with colours but no archived logo
    expect(getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr === "DEL")).toBeDefined();
    expect(teamColorsSync("ncaa_whockey", ["DEL"])[0]).toBeDefined();
    const other = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr !== "DEL")?.team_id as string;
    let logos = logoIcons("ncaa_whockey", [other]);
    const w = warnings(() => {
      logos = logoIcons("ncaa_whockey", [other, "DEL"]);
      logoIcons("ncaa_whockey", [other, "DEL"]); // a re-render does not warn again
    });
    expect(logos.domain).toEqual([other]);
    expect(symbols(logos.svgDefs)).toHaveLength(1);
    expect(logos("DEL")).toBeUndefined();
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/no logo archived: DEL/);
  });

  test("an unknown team has no icon, with the resolver's one warning; no teams, no defs", () => {
    let logos = logoIcons<string>("nfl", []);
    const w = warnings(() => {
      logos = logoIcons("nfl", ["XXX", "KC"]);
    });
    expect(logos.domain).toEqual(["KC"]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/XXX/);
    expect(logoIcons("nfl", []).svgDefs).toBe("");
  });

  test("headshots by ESPN id (number or string) and by gsis id; a gsis id with no headshot has none, one warning", async () => {
    const heads = headshotIcons("nfl", [3139477, "15847", "3139477"]);
    expect(heads.domain).toEqual([3139477, "15847", "3139477"]);
    const defs = symbols(heads.svgDefs);
    expect(defs.map((s) => s.href)).toEqual([headshotUrl(3139477, "nfl"), headshotUrl(15847, "nfl")]);
    expect(defs[0]?.viewBox).toBe(`0 0 ${Math.round(100 * HEADSHOT_ASPECT * 1e4) / 1e4} 100`);
    expect(heads(3139477)).toBe(`#${defs[0]?.id}`);
    expect(heads("3139477")).toBe(heads(3139477));
    expect(heads(15847)).toBe(`#${defs[1]?.id}`);
    const { loadGsis } = await import("../src/headshots.js");
    await loadGsis();
    let gsis = headshotIcons<string>("nfl", [], { idSystem: "gsis" });
    const w = warnings(() => {
      gsis = headshotIcons("nfl", ["00-0033873", "00-9999999"], { idSystem: "gsis" });
    });
    expect(gsis.domain).toEqual(["00-0033873"]);
    expect(symbols(gsis.svgDefs)[0]?.href).toBe(headshotUrl("00-0033873", "nfl", { idSystem: "gsis" }));
    // the node icon accessor by gsis id: the one symbol, its URL the gsis headshot; a gsis id with no headshot, none
    expect(gsis("00-0033873")).toBe(`#${symbols(gsis.svgDefs)[0]?.id}`);
    expect(gsis(" 00-0033873 ")).toBe(gsis("00-0033873"));
    expect(gsis("00-9999999")).toBeUndefined();
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/no headshot: 00-9999999/);
  });
});
