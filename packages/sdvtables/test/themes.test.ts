import { preloadAll } from "@sportsdataverse/sdvplot";
import { expect, test } from "vitest";
import { fontsLink } from "../src/html/fonts.js";
import { THEMES, THEME_NAMES, resolveTheme } from "../src/themes/index.js";
import { secondaryOn } from "../src/themes/sdv.js";
import { DENSITY, TOKEN_KEYS, densitySizes, scaleFor } from "../src/themes/tokens.js";
test("density sizes are sdvplotR's .theme_density() values and multipliers", () => {
  expect(DENSITY.comfortable).toEqual({
    body: 14,
    pad: 6,
    title: 26,
    subtitle: 15,
    label: 10,
    group: 11,
    source: 11,
  });
  expect(DENSITY.compact).toEqual({
    body: 12,
    pad: 3,
    title: 22,
    subtitle: 13,
    label: 9,
    group: 10,
    source: 10,
  });
  expect(DENSITY.social).toEqual({
    body: 17,
    pad: 9,
    title: 34,
    subtitle: 19,
    label: 12,
    group: 13,
    source: 13,
  });
  expect(scaleFor("social").body).toBeCloseTo(17 / 14);
  expect(scaleFor("comfortable").pad).toBe(1);
  expect(() => densitySizes("roomy" as never)).toThrow(/comfortable, compact or social/);
});
test("every registered theme defines every token at every density (completeness)", () => {
  expect(Object.keys(THEMES)).toEqual(THEME_NAMES);
  for (const name of THEME_NAMES)
    for (const density of ["comfortable", "compact", "social"] as const) {
      const t = resolveTheme({
        name,
        density,
        ...(name === "sdvTeam" ? { options: { league: "nfl" } } : {}),
      });
      for (const k of TOKEN_KEYS) expect(t.tokens[k], `${name}/${density}/${k}`).toMatch(/\S/);
      expect(t.fonts.every((f) => f.weights.length > 0)).toBe(true);
    }
});
test("sdv light/dark palettes are _marks.py's", () => {
  const light = resolveTheme({ name: "sdv", density: "comfortable" });
  const dark = resolveTheme({ name: "sdv", density: "comfortable", options: { style: "dark" } });
  expect(light.tokens.bg).toBe("#FFFFFF");
  expect(light.tokens.text).toBe("#0B1A33");
  expect(light.tokens.labelColor).toBe("#16305C");
  expect(light.tokens.rule).toBe("#E3E8F1");
  expect(light.tokens.groupBg).toBe("#EEF3FA");
  expect(dark.tokens.bg).toBe("#0B1A33");
  expect(dark.tokens.labelColor).toBe("#9CCBFF");
  expect(dark.tokens.text).toBe("#EAEBEC");
  expect(dark.tokens.rule).toBe("#1D3A66");
  expect(light.tokens.horizon).toBe("linear-gradient(90deg, #3346F0, #7FE6DC)");
  expect(light.tokens.bodySize).toBe("15px");
  expect(resolveTheme({ name: "sdv", density: "social" }).tokens.bodySize).toBe("18.2px");
  expect(() => resolveTheme({ name: "sdv", density: "comfortable", options: { style: "sepia" } })).toThrow(
    /light.*dark/,
  );
});
test("sdvTeam: KC heading in primary, ink by contrast; unknown team throws", async () => {
  await preloadAll();
  const kc = resolveTheme({
    name: "sdvTeam",
    density: "comfortable",
    options: { league: "nfl", team: "KC" },
  });
  expect(kc.tokens.headingBg).toBe("#e31837");
  expect(kc.tokens.titleColor).toBe("#ffffff");
  expect(() =>
    resolveTheme({ name: "sdvTeam", density: "comfortable", options: { league: "nfl", team: "ZZZ" } }),
  ).toThrow(/ZZZ/);
  expect(() => resolveTheme({ name: "sdvTeam", density: "comfortable" })).toThrow(/league/);
});
test("Google Fonts link requests every weight once, alphabetical, display=swap", () => {
  expect(
    fontsLink([
      { family: "Lato", weights: [400, 700] },
      { family: "Chivo", weights: [500, 800] },
      { family: "Lato", weights: [400] },
    ]),
  ).toBe(
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chivo:wght@500;800&amp;family=Lato:wght@400;700&amp;display=swap">',
  );
  expect(fontsLink([])).toBe("");
});
test("53 tokens (49 + four padding roles)", () => {
  expect(TOKEN_KEYS.length).toBe(53);
  expect(new Set(TOKEN_KEYS).size).toBe(53);
});
test("sdv padding roles are _marks._build_theme's, scaled by density (_marks.py:662-682)", () => {
  const pads = (density: "comfortable" | "compact" | "social") => {
    const t = resolveTheme({ name: "sdv", density }).tokens;
    return [t.headingPad, t.labelPad, t.pad, t.groupPad, t.sourcePad];
  };
  expect(pads("comfortable")).toEqual(["4px", "6px", "7px", "8px", "4px"]);
  expect(pads("compact")).toEqual(["2px", "3px", "3.5px", "4px", "2px"]);
  expect(pads("social")).toEqual(["6px", "9px", "10.5px", "12px", "6px"]);
});
test("sdv theme rules out-specify the base label padding (th.sdvt-label)", () => {
  expect(resolveTheme({ name: "sdv", density: "comfortable" }).rules("#t")).toContain(
    "#t th.sdvt-label{padding-bottom:10px}",
  );
});
test("secondaryOn matches _marks._secondary_on", () => {
  expect(secondaryOn("#003594", "#ffffff")).toBe("#99aed4");
  expect(secondaryOn("#d3bc8d", "#000000")).toBe("#544b38");
  expect(secondaryOn("#007bc7", "#000000")).toBe("#00060a");
  expect(secondaryOn("#e31837", "#ffffff")).toBe("#ffffff");
});
test("sdvTeam branches match gt_theme_sdv_team (real teams)", async () => {
  await preloadAll();
  const team = (t: string) =>
    resolveTheme({ name: "sdvTeam", density: "comfortable", options: { league: "nfl", team: t } }).tokens;
  const kc = team("KC");
  expect(kc.horizon).toBe("#ffb612");
  expect(kc.labelColor).toBe("#e31837");
  expect(kc.subtitleColor).toBe("#ffffff");
  const lar = team("LAR"); // pale secondary (contrast 1.46 < 1.5): horizon falls back to primary
  expect(lar.horizon).toBe("#003594");
  expect(lar.subtitleColor).toBe("#99aed4");
  const no = team("NO"); // light primary (1.85 < 3): label falls back to navy; ink is black
  expect(no.labelColor).toBe("#0B1A33");
  expect(no.titleColor).toBe("#000000");
  expect(no.subtitleColor).toBe("#544b38");
  expect(no.headingBg).toBe("#d3bc8d");
  const lac = team("LAC");
  expect(lac.titleColor).toBe("#000000");
  expect(lac.subtitleColor).toBe("#00060a");
});
test("sdvTeam without a team uses the SportsDataverse colors; dark sdv keeps the gradient", () => {
  const d = resolveTheme({ name: "sdvTeam", density: "comfortable", options: { league: "nfl" } }).tokens;
  expect(d.headingBg).toBe("#0B1A33");
  expect(d.titleColor).toBe("#ffffff");
  expect(d.horizon).toBe("#0B1A33"); // cyan is pale (contrast < 1.5): horizon falls back to primary
  expect(
    resolveTheme({ name: "sdv", density: "comfortable", options: { style: "dark" } }).tokens.horizon,
  ).toBe("linear-gradient(90deg, #3346F0, #7FE6DC)");
});
