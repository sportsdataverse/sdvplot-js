// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InputError } from "../src/errors.js";
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
import {
  type LogoImageMap,
  type LogoSymbols,
  OPENFREEMAP_ATTRIBUTION,
  addLogoImages,
  basemap,
  drawnMarks,
  logoSymbols,
  routeLines,
} from "../src/maplibre.js";
import { teamColorPalette as rechartsPalette } from "../src/recharts.js";
import "./_fixtures.js";

/**
 * The style JSON `./maplibre` builds, checked value by value and by MapLibre's own style validator (the
 * `@maplibre/maplibre-gl-style-spec` that maplibre-gl 6.14 ships with). What MapLibre draws from it, and where, is the
 * Chromium render test's (examples/test/interactive.test.ts).
 */
beforeEach(() => resetWarnings());

const HERE = dirname(fileURLToPath(import.meta.url));
// the style spec is maplibre-gl's own dependency: resolve it from there (pnpm keeps it out of sdvplot's node_modules)
const spec = createRequire(createRequire(import.meta.url).resolve("maplibre-gl/package.json"))(
  "@maplibre/maplibre-gl-style-spec",
) as { validateStyleMin: (style: object) => { message: string }[] };
/** MapLibre's validation errors for a style holding just these sources and layers. */
const invalid = (...sets: { id: string; source: object; layer: object }[]): string[] =>
  spec
    .validateStyleMin({
      version: 8,
      sources: Object.fromEntries(sets.map((s) => [s.id, s.source])),
      layers: sets.map((s) => s.layer),
    })
    .map((e) => e.message);

/** The committed stadium fixture (nfl-data's copy of nfelo's stadiums.csv): each team's 2024 home stadium. */
const STADIUMS = Object.fromEntries(
  readFileSync(resolve(HERE, "../../../fixtures/examples/nfl_stadiums_2024.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(","))
    .map(([team, , , lat, lon]) => [team as string, [Number(lon), Number(lat)] as [number, number]]),
);
const AT = (t: string) => STADIUMS[t] as [number, number];
const ID = (t: string) => resolveSync(t, "nfl") as string;
const URL_OF = (t: string) => logoUrlSync(t, "nfl") as string;
const BASE = { x: "lon", y: "lat", team: "team", league: "nfl" } as const;
function warnings(fn: () => unknown): string[] {
  const spy = vi.fn();
  setWarningHandler(spy);
  try {
    fn();
  } finally {
    setWarningHandler(null);
  }
  return spy.mock.calls.map((c) => String(c[0]));
}
const venue = (team: unknown, abbr: string) => ({ team, lon: AT(abbr)[0], lat: AT(abbr)[1] });

describe("logoSymbols", () => {
  test("one point per row at its stadium, the row's index as id, an image per logo, and a valid symbol layer", () => {
    const rows = [venue("KC", "KC"), venue("BUF", "BUF"), venue("PHI", "PHI"), venue("KC", "KC")];
    const s = logoSymbols(rows, { ...BASE, size: 40, alpha: 0.9 });
    const f = s.source.data.features;
    expect(f.map((x) => x.id)).toEqual([0, 1, 2, 3]);
    expect(f.map((x) => x.geometry)).toEqual(
      ["KC", "BUF", "PHI", "KC"].map((t) => ({ type: "Point", coordinates: AT(t) })),
    );
    expect(f.map((x) => x.properties.team)).toEqual(["KC", "BUF", "PHI", "KC"].map(ID));
    expect(f.map((x) => x.properties.url)).toEqual(["KC", "BUF", "PHI", "KC"].map(URL_OF));
    expect(f.map((x) => x.properties.index)).toEqual([0, 1, 2, 3]);
    // one image per distinct logo, drawn 40 px tall; each feature names its own logo's image
    expect(s.images.map((im) => [im.url, im.height])).toEqual(
      ["KC", "BUF", "PHI"].map((t) => [URL_OF(t), 40]),
    );
    const byId = new Map(s.images.map((im) => [im.id, im.url]));
    expect(f.map((x) => byId.get(x.properties.icon))).toEqual(f.map((x) => x.properties.url));
    expect(new Set(s.images.map((im) => im.id)).size).toBe(3);
    expect(s.id).toBe("sdvplot-logos");
    expect(s.layer).toEqual({
      id: "sdvplot-logos",
      type: "symbol",
      source: "sdvplot-logos",
      layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-ignore-placement": true },
      paint: { "icon-opacity": 0.9 },
    });
    expect(invalid(s)).toEqual([]);
  });

  test("numeric and string ESPN ids give the same features as abbreviations", () => {
    const teams = ["KC", "BUF", "PHI"];
    const abbr = logoSymbols(
      teams.map((t) => venue(t, t)),
      BASE,
    );
    const asNumber = logoSymbols(
      teams.map((t) => venue(Number(ID(t)), t)),
      BASE,
    );
    const asString = logoSymbols(
      teams.map((t) => venue(ID(t), t)),
      BASE,
    );
    expect(teams.map((t) => Number(ID(t)))).toEqual([12, 2, 21]); // the ESPN ids, numbers in the rows
    expect(asNumber).toEqual(abbr);
    expect(asString).toEqual(abbr);
  });

  test("an unknown team and a missing coordinate are left out, one warning each; the others keep their index", () => {
    const rows = [venue("ZZZ", "KC"), venue("BUF", "BUF"), { team: "PHI", lon: null, lat: 39.9 }];
    let s: LogoSymbols | undefined;
    const w = warnings(() => {
      s = logoSymbols(rows, BASE);
      logoSymbols(rows, BASE); // a rebuild does not warn again
    });
    expect(drawnMarks(s as LogoSymbols)).toEqual([[ID("BUF"), ...AT("BUF"), 32, URL_OF("BUF")]]);
    expect(s?.source.data.features[0]?.id).toBe(1);
    expect(s?.images).toHaveLength(1);
    expect(w).toHaveLength(2);
    expect(w.join("\n")).toMatch(/ZZZ/);
    expect(w.join("\n")).toMatch(/missing x or y/);
  });

  test("a team with colours but no archived logo draws nothing and warns once", async () => {
    await loadLeague("ncaa_whockey");
    expect(teamColorsSync("ncaa_whockey", ["DEL"])[0]).toBeDefined();
    const other = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr !== "DEL")?.team_id as string;
    let s: LogoSymbols | undefined;
    const w = warnings(() => {
      s = logoSymbols(
        [
          { team: other, lon: -75.75, lat: 39.68 },
          { team: "DEL", lon: -75.75, lat: 39.68 },
        ],
        { ...BASE, league: "ncaa_whockey" },
      );
    });
    expect(s?.source.data.features.map((f) => f.properties.team)).toEqual([other]);
    expect(s?.images).toHaveLength(1);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/no logo archived: DEL/);
  });

  test("size and alpha are checked", () => {
    expect(() => logoSymbols([], { ...BASE, size: 0.1 })).toThrow(InputError);
    expect(() => logoSymbols([], { ...BASE, alpha: 2 })).toThrow(InputError);
    expect(() => logoSymbols([venue("KC", "KC")], { ...BASE, team: "nope" })).toThrow(InputError);
  });
});

/** A map that records its images; `fail` urls reject on load, as a 404 does. */
function fakeMap(fail: string[] = []) {
  const images = new Map<string, { image: unknown; pixelRatio: number | undefined }>();
  const loads: string[] = [];
  const map = {
    hasImage: (id: string) => images.has(id),
    loadImage: async (url: string) => {
      loads.push(url);
      await new Promise((r) => setTimeout(r, 1));
      if (fail.includes(url)) throw new Error("404");
      return { data: { width: 500, height: 500, url } as unknown as ImageBitmap };
    },
    addImage(id: string, image: unknown, o?: { pixelRatio?: number }) {
      if (images.has(id)) throw new Error(`An image named "${id}" already exists.`); // as MapLibre does
      images.set(id, { image, pixelRatio: o?.pixelRatio });
      return this;
    },
  };
  return { map: map as unknown as LogoImageMap, images, loads };
}

describe("addLogoImages", () => {
  test("adds each logo once, at the pixel ratio that draws it `size` px tall", async () => {
    const a = logoSymbols([venue("KC", "KC"), venue("BUF", "BUF"), venue("KC", "KC")], { ...BASE, size: 40 });
    const b = logoSymbols([venue("BUF", "BUF")], { ...BASE, size: 40, id: "again" });
    const { map, images, loads } = fakeMap();
    await addLogoImages(map, a, b);
    await addLogoImages(map, a); // again: nothing new
    expect([...images.keys()]).toEqual(a.images.map((im) => im.id));
    expect([...images.values()].map((v) => v.pixelRatio)).toEqual([500 / 40, 500 / 40]);
    expect(loads).toEqual([URL_OF("KC"), URL_OF("BUF")]);
  });

  test("two calls racing for the same logo add it once", async () => {
    const a = logoSymbols([venue("KC", "KC")], BASE);
    const { map, images } = fakeMap();
    await Promise.all([addLogoImages(map, a), addLogoImages(map, a)]);
    expect(images.size).toBe(1);
  });

  test("a logo that fails to load is skipped with one warning; the rest are added", async () => {
    const a = logoSymbols([venue("KC", "KC"), venue("BUF", "BUF")], BASE);
    const { map, images } = fakeMap([URL_OF("KC")]);
    const spy = vi.fn();
    setWarningHandler(spy);
    try {
      await addLogoImages(map, a);
      await addLogoImages(map, a);
    } finally {
      setWarningHandler(null);
    }
    expect([...images.keys()]).toEqual([a.images[1]?.id]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain(URL_OF("KC"));
  });
});

describe("routeLines", () => {
  // KC's and PHI's week 3 and 4 road games of 2024, stadium to stadium
  const legs = (k: (t: string) => unknown) =>
    [
      { team: k("KC"), from: "KC", to: "ATL" },
      { team: k("PHI"), from: "PHI", to: "NO" },
      { team: k("KC"), from: "KC", to: "LAC" },
      { team: k("PHI"), from: "PHI", to: "TB" },
    ].map((l) => ({ team: l.team, x0: AT(l.from)[0], y0: AT(l.from)[1], x1: AT(l.to)[0], y1: AT(l.to)[1] }));
  const RO = { x: "x0", y: "y0", xend: "x1", yend: "y1", team: "team", league: "nfl" } as const;

  test("one line per row in its team's primary colour, the row's index as id, and a valid line layer", () => {
    const r = routeLines(
      legs((t) => t),
      { ...RO, width: 4, alpha: 0.8 },
    );
    const [kc, phi] = teamColorsSync("nfl", ["KC", "PHI"]) as string[];
    expect(r.source.data.features).toEqual(
      (
        [
          ["KC", "ATL", kc],
          ["PHI", "NO", phi],
          ["KC", "LAC", kc],
          ["PHI", "TB", phi],
        ] as const
      ).map(([t, to, color], i) => ({
        type: "Feature",
        id: i,
        geometry: { type: "LineString", coordinates: [AT(t), AT(to)] },
        properties: { team: ID(t), color, index: i },
      })),
    );
    expect(kc).not.toBe(phi);
    expect(r.layer).toEqual({
      id: "sdvplot-routes",
      type: "line",
      source: "sdvplot-routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.8 },
    });
    expect(invalid(r)).toEqual([]);
  });

  test("numeric and string ids colour exactly as abbreviations; 12 and 'KC' in one input are one team", () => {
    const abbr = routeLines(
      legs((t) => t),
      RO,
    );
    expect(
      routeLines(
        legs((t) => Number(ID(t))),
        RO,
      ),
    ).toEqual(abbr);
    expect(
      routeLines(
        legs((t) => ID(t)),
        RO,
      ),
    ).toEqual(abbr);
    const mixed = routeLines(
      legs((t) => (t === "KC" ? 12 : t)).map((l, i) => (i === 2 ? { ...l, team: "KC" } : l)),
      { ...RO, background: "#0c0c0c" },
    );
    const colors = mixed.source.data.features.map((f) => f.properties.color);
    expect(colors[0]).toBe(colors[2]);
  });

  test("on the dark basemap every colour reads (3:1) and equals the shared palette's", () => {
    const { background } = basemap("dark");
    const r = routeLines(
      legs((t) => t),
      { ...RO, background },
    );
    const want = rechartsPalette("nfl", ["KC", "PHI"], { background });
    expect(r.source.data.features.map((f) => f.properties.color)).toEqual([
      want[0],
      want[1],
      want[0],
      want[1],
    ]);
    for (const c of want) expect(contrast(c as string, background)).toBeGreaterThanOrEqual(3);
    // PHI's midnight green does not read on #0c0c0c: the palette moved it
    expect(want[1]).not.toBe(teamColorsSync("nfl", ["PHI"])[0]);
  });

  test("an unresolved team takes the fallback; a missing coordinate is left out with one warning", () => {
    const rows = legs((t) => t);
    rows[1] = { ...(rows[1] as (typeof rows)[number]), team: "ZZZ" };
    rows[3] = { ...(rows[3] as (typeof rows)[number]), x1: Number.NaN };
    let r: ReturnType<typeof routeLines> | undefined;
    const w = warnings(() => {
      r = routeLines(rows, { ...RO, fallback: "#123456" });
    });
    expect(r?.source.data.features.map((f) => [f.id, f.properties.team, f.properties.color])).toEqual([
      [0, ID("KC"), teamColorsSync("nfl", ["KC"])[0]],
      [1, "ZZZ", "#123456"],
      [2, ID("KC"), teamColorsSync("nfl", ["KC"])[0]],
    ]);
    // one for the leg left out, one from resolving ZZZ (as `./deckgl`'s arcs)
    expect(w).toHaveLength(2);
    expect(w.filter((m) => /missing coordinate: PHI/.test(m))).toHaveLength(1);
    expect(w.filter((m) => /ZZZ/.test(m))).toHaveLength(1);
  });

  test("width and alpha are checked", () => {
    expect(() => routeLines([], { ...RO, width: 0 })).toThrow(InputError);
    expect(() => routeLines([], { ...RO, alpha: -1 })).toThrow(InputError);
  });
});

describe("basemap", () => {
  test("OpenFreeMap's positron and dark styles, keyless, with the provider's credit", () => {
    expect(basemap()).toEqual({
      style: "https://tiles.openfreemap.org/styles/positron",
      background: "#f2f3f0",
      attribution: OPENFREEMAP_ATTRIBUTION,
    });
    expect(basemap("dark")).toEqual({
      style: "https://tiles.openfreemap.org/styles/dark",
      background: "#0c0c0c",
      attribution: OPENFREEMAP_ATTRIBUTION,
    });
    expect(OPENFREEMAP_ATTRIBUTION).toContain("OpenFreeMap");
    expect(OPENFREEMAP_ATTRIBUTION).toContain("https://www.openstreetmap.org/copyright");
    expect(JSON.stringify(basemap("dark"))).not.toMatch(/key|token/i);
    expect(() => basemap("dusk" as never)).toThrow(InputError);
  });
});
