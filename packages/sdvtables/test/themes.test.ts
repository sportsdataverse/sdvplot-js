import { preloadAll } from "@sportsdataverse/sdvplot";
import { expect, test } from "vitest";
import { fontsLink } from "../src/html/fonts.js";
import { THEMES, THEME_NAMES, resolveTheme } from "../src/themes/index.js";
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
