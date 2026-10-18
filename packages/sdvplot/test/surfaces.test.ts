import { SportyError } from "@sportsdataverse/sporty";
import { surfaceMark } from "@sportsdataverse/sporty/plot";
import { beforeAll, expect, test } from "vitest";
import { teamColorPairSync } from "../src/colors.js";
import { InputError, loadLeague, resetWarnings, setWarningHandler, teamColorsSync } from "../src/index.js";
import { SURFACES, surfaceScene } from "../src/surfaces.js";

beforeAll(async () => {
  await Promise.all(["nhl", "ohl", "nba"].map((l) => loadLeague(l as never)));
}, 60_000);
const fill = (scene: ReturnType<typeof surfaceScene>, name: string) => {
  const f = scene.features.find((x) => x.kind === "polygon" && x.name === name);
  return f?.kind === "polygon" ? f.fill.toLowerCase() : undefined;
};
const primaryOf = (league: "nhl" | "ohl" | "nba", team: string) =>
  teamColorsSync(league, [team], { which: "primary" })[0]?.toLowerCase();

test("surfaceScene paints the boards in the team's primary colour", () => {
  const scene = surfaceScene("nhl", { team: "BOS" });
  expect(fill(scene, "boards")).toBe(primaryOf("nhl", "BOS"));
  expect(scene.sport).toBe("hockey");
});
test("an unresolved team draws the plain surface and warns exactly once", () => {
  const msgs: string[] = [];
  resetWarnings();
  setWarningHandler((m) => msgs.push(m));
  try {
    const scene = surfaceScene("nhl", { team: "ZZZ-nobody" });
    expect(fill(scene, "boards")).toBe(fill(surfaceScene("nhl"), "boards"));
    expect(msgs).toHaveLength(1);
  } finally {
    setWarningHandler(null);
    resetWarnings();
  }
});
test("a team with no secondary colour accents with its primary", () => {
  const scene = surfaceScene("ohl", { team: "6" });
  const p = primaryOf("ohl", "6");
  expect(p).toBeDefined();
  expect(fill(scene, "boards")).toBe(p);
  expect(fill(scene, "center_line")).toBe(p);
});
test("user colorUpdates override a painted key", () => {
  const scene = surfaceScene("nba", { team: "LAL", colorUpdates: { painted_area: "#123456" } });
  expect(fill(scene, "painted_area")).toBe("#123456");
  expect(fill(scene, "court_apron")).toBe(primaryOf("nba", "LAL"));
});
test("sporty errors escape unwrapped, not as InputError", () => {
  for (const o of [{ displayRange: "nope" as never }, { units: "furlong" as never }]) {
    let err: unknown;
    try {
      surfaceScene("nhl", o);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SportyError);
    expect(err).not.toBeInstanceOf(InputError);
  }
});
test("every SURFACES entry builds a non-empty scene (guards typo'd sporty league keys)", () => {
  for (const league of Object.keys(SURFACES)) {
    expect(surfaceScene(league as never).features.length, league).toBeGreaterThan(0);
  }
});

// The shared SDV surface-key table (sdvplot SURFACES, sdvplotR surface_map, this file): key -> [sporty sport, league].
const SHARED: Record<string, readonly [string, string]> = {
  mlb: ["baseball", "mlb"],
  milb: ["baseball", "milb"],
  ncaa_baseball: ["baseball", "ncaa"],
  little_league: ["baseball", "little league"],
  pony: ["baseball", "pony"],
  nfhs_baseball: ["baseball", "nfhs"],
  ncaa_softball: ["softball", "ncaa"],
  soccer: ["soccer", "fifa"],
  fifa: ["soccer", "fifa"],
  epl: ["soccer", "epl"],
  mls: ["soccer", "mls"],
  nwsl: ["soccer", "nwsl"],
  ncaa_soccer: ["soccer", "ncaa"],
  fiba: ["basketball", "fiba"],
  nfhs_basketball: ["basketball", "nfhs"],
  cfl: ["football", "cfl"],
  nfhs_football: ["football", "nfhs11"],
  iihf: ["hockey", "iihf"],
  nwhl: ["hockey", "nwhl"],
  pwhl: ["hockey", "pwhl"],
  nll: ["lacrosse", "nll"],
  pll: ["lacrosse", "pll"],
  world_lacrosse: ["lacrosse", "world lacrosse"],
  ncaa_mlacrosse: ["lacrosse", "ncaam"],
  ncaa_wlacrosse: ["lacrosse", "ncaaw"],
  usa_mlacrosse: ["lacrosse", "usam"],
  usa_wlacrosse: ["lacrosse", "usaw"],
  atp: ["tennis", "atp"],
  wta: ["tennis", "wta"],
  itf: ["tennis", "itf"],
  ita: ["tennis", "ita"],
  usta: ["tennis", "usta"],
  ncaa_tennis: ["tennis", "ncaa"],
  fivb: ["volleyball", "fivb"],
  usa_volleyball: ["volleyball", "usa volleyball"],
  ncaa_volleyball: ["volleyball", "ncaa"],
  wcf: ["curling", "wcf"],
  curling_canada: ["curling", "curling canada"],
};
test("every key of the shared surface table maps onto sporty and resolves to a renderable scene", () => {
  for (const [key, [sport, league]] of Object.entries(SHARED)) {
    expect(SURFACES[key as keyof typeof SURFACES], key).toEqual([sport, league]);
    const scene = surfaceScene(key as never, { arcResolution: 24 });
    expect([scene.sport, scene.league], key).toEqual([sport, league]);
    expect(surfaceMark(scene).length, key).toBeGreaterThan(0);
    expect(scene.bbox[2] > scene.bbox[0] && scene.bbox[3] > scene.bbox[1], key).toBe(true);
  }
});
test("ncaa_softball is both a team league and a surface: the field draws with the team's colours resolved", async () => {
  await loadLeague("ncaa_softball");
  expect(teamColorPairSync("ncaa_softball", "CBU").primary).toBe("#000080");
  const scene = surfaceScene("ncaa_softball", { team: "CBU" });
  expect(scene.sport).toBe("softball");
  expect(scene.features.length).toBeGreaterThan(0);
});
test("a team on a surface without team identities is an InputError naming the league", () => {
  for (const key of ["atp", "wcf", "fiba", "nll"]) {
    expect(() => surfaceScene(key as never, { team: "X" }), key).toThrow(InputError);
    expect(() => surfaceScene(key as never, { team: "X" }), key).toThrow(
      new RegExp(`no team identities for '${key}'`),
    );
  }
});
test("the soccer key draws the 105 x 68 m pitch (like sdvplot/sdvplotR); fifa keeps sportyR's 120 x 90; updates win", () => {
  expect(surfaceScene("soccer" as never).bbox[2]).toBeLessThan(surfaceScene("fifa" as never).bbox[2]);
  const touch = (s: ReturnType<typeof surfaceScene>) => s.features.find((f) => f.name === "touchline");
  expect(touch(surfaceScene("soccer" as never))).toBeDefined();
  expect(surfaceScene("soccer" as never, { updates: { pitch_length: 120, pitch_width: 90 } }).bbox).toEqual(
    surfaceScene("fifa" as never).bbox,
  );
});
