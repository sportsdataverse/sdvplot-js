import { onColor, preloadAll } from "@sportsdataverse/sdvplot";
import { expect, test } from "vitest";
import { fontsLink } from "../src/html/fonts.js";
import { THEMES, THEME_NAMES, resolveTheme } from "../src/themes/index.js";
import { adjustLuminance } from "../src/themes/luminance.js";
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
      for (const k of TOKEN_KEYS) {
        const v = t.tokens[k];
        expect(v, `${name}/${density}/${k}`).toMatch(/\S/);
        expect(v, `${name}/${density}/${k}`).not.toMatch(/undefined|NaN/);
        // border tokens (and hline) may legitimately be "none"
        if (/^(bg|text|muted|accent|rule|pad)$|(Bg|Color|Size|Pad)$/.test(k))
          expect(v, `${name}/${density}/${k}`).not.toBe("none");
      }
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
test("sdvTeam tokens at compact and social density are _marks.size(n, role)'s (KC)", async () => {
  await preloadAll();
  const kc = (density: "compact" | "social") =>
    resolveTheme({ name: "sdvTeam", density, options: { league: "nfl", team: "KC" } }).tokens;
  const pick = (t: ReturnType<typeof kc>) => [
    t.titleSize,
    t.subtitleSize,
    t.labelSize,
    t.groupSize,
    t.sourceSize,
    t.bodySize,
    t.headingPad,
    t.labelPad,
    t.pad,
    t.groupPad,
    t.sourcePad,
  ];
  // values from `round(n * k[role], 1):g` with n = 22/14/13/13/12/15 and pad 4/6/7/8/4
  expect(pick(kc("compact"))).toEqual([
    "18.6px",
    "12.1px",
    "11.7px",
    "11.8px",
    "10.9px",
    "12.9px",
    "2px",
    "3px",
    "3.5px",
    "4px",
    "2px",
  ]);
  expect(pick(kc("social"))).toEqual([
    "28.8px",
    "17.7px",
    "15.6px",
    "15.4px",
    "14.2px",
    "18.2px",
    "6px",
    "9px",
    "10.5px",
    "12px",
    "6px",
  ]);
  expect(kc("compact").headingBg).toBe("#e31837");
});
// ---- Task 4: the 18 gtUtils themes (values from sdvplot great_tables/_themes.py; line numbers cite that file) ----
const tk = (
  name: string,
  options?: Record<string, string>,
  density: "comfortable" | "compact" | "social" = "comfortable",
) => resolveTheme({ name, density, ...(options ? { options } : {}) }).tokens;
test("midnight tokens and extra rules", () => {
  const t = resolveTheme({ name: "midnight", density: "comfortable" });
  // the accent goes through hex6 (Python _color → hex6, _themes.py:85-90), so it is lowercase; the fixed literals keep their case
  expect(t.tokens).toMatchObject({
    bg: "#0C0D10",
    labelBg: "#16181D",
    text: "#E8E9ED",
    muted: "#9498A3",
    rule: "#24272E",
    accent: "#5b8def",
    tableBorderTop: "2px solid #5b8def",
    labelBorderBottom: "1px solid #24272E",
    hline: "1px solid #24272E",
    groupColor: "#5b8def",
    labelSize: "11px",
    lineHeight: "1.55",
    pad: "6px",
    labelPad: "5px", // max(pad-1, 3): _themes.py:1070
    groupPad: "4px", // max(pad-2, 2): _themes.py:1081
  });
  expect(t.fonts).toEqual([{ family: "Chivo", weights: [400, 600, 700] }]);
  expect(
    resolveTheme({ name: "midnight", density: "compact", options: { accent: "#3FBF87" } }).tokens
      .tableBorderTop,
  ).toBe("2px solid #3fbf87");
  expect(() => resolveTheme({ name: "midnight", density: "compact", options: { accent: "blue" } })).toThrow(
    /accent must be a hex color/,
  );
});
test("broadsheet paper presets", () => {
  const w = resolveTheme({ name: "broadsheet", density: "comfortable" });
  const s = resolveTheme({ name: "broadsheet", density: "comfortable", options: { paper: "salmon" } });
  expect(w.tokens.bg).toBe("#FBFAF7");
  expect(w.tokens.hline).toBe("1px solid #DEDAD2");
  expect(s.tokens.bg).toBe("#FFF1E5");
  expect(s.tokens.hline).toBe("1px solid #EAD9C7");
  expect(
    resolveTheme({ name: "broadsheet", density: "comfortable", options: { paper: "#ffffff" } }).tokens.bg,
  ).toBe("#ffffff");
  expect(w.tokens.fontBody).toMatch(/^'Source Serif 4'/);
  expect(w.tokens.fontTitle).toMatch(/^'Newsreader'/);
  expect(w.tokens.labelTracking).toBe("0.09em");
  expect(w.tokens).toMatchObject({
    labelBorderBottom: "1.5px solid #16130F", // _themes.py:531-534
    labelPad: "4px", // max(pad-2, 2): _themes.py:535
    groupPad: "3px", // max(pad-3, 2): _themes.py:547
    tableBorderTop: "2px solid #a6081a", // _themes.py:523-525
  });
});
test("adjustLuminance reproduces Python _adjust_luminance (values from running _themes.py:179-239, 2026-10-07)", () => {
  expect(adjustLuminance("#123F5E", 0.9)).toBe("#516e8b");
  expect(adjustLuminance("#123F5E", -0.7)).toBe("#00294d");
  expect(adjustLuminance("#E31837", 0.9)).toBe("#ff6676");
  expect(adjustLuminance("#E31837", -0.7)).toBe("#af0000");
  expect(adjustLuminance("#FFB81C", -0.6)).toBe("#de9900");
  expect(adjustLuminance("#FFB81C", 0.5)).toBe("#ffcb47");
});
test("kenpom bands odd/even and the scaled px sizes; sofa/tier style enum; drench derives ink, rule and band", () => {
  const k = resolveTheme({ name: "kenpom", density: "comfortable" });
  expect(k.rules("#x")).toContain("#F2FAFD");
  expect(k.rules("#x")).toContain("#e5ecf9");
  expect(k.tokens.labelColor).toBe("#02b");
  expect(k.tokens.labelBg).toBe("#c3d9ff");
  expect(resolveTheme({ name: "kenpom", density: "social" }).tokens.titleSize).toBe("23.5px"); // 18 * 34/26
  expect(tk("sofa", { style: "dark" }).bg).toBe("#1c2632");
  expect(() => tk("tier", { style: "sepia" })).toThrow(/light.*dark/);
  const dr = resolveTheme({ name: "drench", density: "comfortable", options: { color: "#E31837" } });
  expect(dr.tokens.bg).toBe("#e31837");
  expect(dr.tokens.text).toBe("#ffffff");
  expect(dr.tokens.labelBg).toBe("#e31837");
  // white ink → the light-type branch (_themes.py:929-930): rule = adjustLuminance(color, 0.9), band = adjustLuminance(color, −0.7) — oracle values above
  expect(dr.tokens.hline).toBe("1px solid #ff6676");
  expect(dr.tokens.groupBg).toBe("#af0000");
  expect(THEME_NAMES.length).toBe(20);
});
test("almanac, athletic, booktabs spot values", () => {
  const a = tk("almanac", undefined, "compact");
  expect(a).toMatchObject({
    accent: "#8c2f1e",
    tableBorderTop: "2px solid #8c2f1e", // _themes.py:308-310
    labelSize: "10px", // label + 1: _themes.py:288
    labelBorderBottom: "1.5px solid #1A1A1A", // _themes.py:316-318
    labelPad: "4px", // pad + 1: _themes.py:318
    groupPad: "3px", // max(pad, 3): _themes.py:329
    stripe: "#f1f1ef", // _themes.py:304
  });
  expect(tk("almanac", { stripe: "none" }).stripe).toBe("transparent"); // stripe=None: _themes.py:242
  expect(() => tk("almanac", { stripe: "grey" })).toThrow(/stripe must be a hex color/);
  expect(tk("athletic")).toMatchObject({
    hline: "1.5px dotted black", // _themes.py:1371
    titleSize: "22px", // _themes.py:1364
    labelSize: "12px", // _themes.py:1363
    groupBg: "black", // _themes.py:1367
    bodyWeight: "500", // _themes.py:1362
  });
  expect(tk("athletic", undefined, "compact").titleSize).toBe("18.6px"); // 22 * 22/26
  expect(tk("booktabs")).toMatchObject({
    labelBorderTop: "2px solid #111111", // _themes.py:418-420
    bodyBorderBottom: "2px solid #111111", // _themes.py:430-432
    labelPad: "5px", // max(pad-1, 2): _themes.py:424
    groupSize: "12px", // group + 1
  });
});
test("brutalist, drench (dark ground), scoreboard spot values", () => {
  expect(tk("brutalist")).toMatchObject({
    tableBorderTop: "3px solid #000000", // _themes.py:830-832
    tableBorderBottom: "3px solid #000000",
    tableBorderX: "3px solid #000000",
    titleSize: "32px", // title + 6: _themes.py:815
    labelBg: "#000000",
    labelColor: "#FFFFFF", // _themes.py:820
    hline: "1px solid #000000", // _themes.py:851-852
    groupBorderTop: "2px solid #000000", // _themes.py:854-856
  });
  const dk = tk("drench", { color: "#FFB81C" }); // dark type: _themes.py:927-930
  expect(dk).toMatchObject({
    text: "#000000",
    hline: `1px solid ${adjustLuminance("#FFB81C", -0.6)}`,
    groupBg: adjustLuminance("#FFB81C", 0.5),
    pad: "7px", // pad + 1: _themes.py:958
    bodyWeight: "500",
    lineHeight: "normal", // the 1.55 leading is for light type only: _themes.py:986
  });
  expect(tk("drench", { color: "#123F5E" }).lineHeight).toBe("1.55");
  const sb = tk("scoreboard", undefined, "compact");
  expect(sb).toMatchObject({
    labelBg: "#0e1621", // accent through hex6: _themes.py:1146
    labelColor: onColor("#0e1621"), // _themes.py:1149
    groupBg: "#F2F4F6", // _themes.py:1165
    bodyBorderBottom: "2px solid #0e1621", // _themes.py:1186-1188
    labelSize: "11px", // label + 2: _themes.py:1152
    titleSize: "26px", // title + 4: _themes.py:1157
    hline: "1px solid #E6E9ED", // _themes.py:1184-1185
  });
});
test("gtutils, ncaa, pl, savant spot values (hard-coded px × the density multipliers)", () => {
  expect(tk("gtutils")).toMatchObject({
    bg: "#FFFDF5", // _themes.py:1479
    hline: "1px solid #8A817C", // _themes.py:1458
    groupBg: "#8A817C", // _themes.py:1454
    groupColor: "#FFFDF5",
    labelSize: "14px", // _themes.py:1451
    pad: "1px", // _themes.py:1461
    bodySize: "16px", // great_tables' 16px table font: nothing in _themes.py:1444-1498 sets one
  });
  expect(tk("gtutils", undefined, "compact")).toMatchObject({ pad: "0.5px", bodySize: "13.7px" }); // ×3/6, ×12/14
  expect(tk("ncaa")).toMatchObject({
    labelBg: "#000000", // _themes.py:1649
    labelColor: "white",
    labelBorderTop: "1px solid black", // _themes.py:1669-1670
    groupBg: "#3C3A40", // _themes.py:1661
    stripe: "#F4F4F4", // opt_row_striping() default: _themes.py:1686
    titleSize: "18px", // _themes.py:1655
  });
  expect(tk("pl")).toMatchObject({
    text: "#37003c", // _themes.py:1743-1745
    labelColor: "#87668a", // _themes.py:1746
    groupBg: "#C0BACA", // _themes.py:1751
    hline: "1px solid #37003c", // _themes.py:1755
    pad: "2px", // _themes.py:1768
  });
  expect(tk("savant")).toMatchObject({
    groupBg: "#000000", // _themes.py:1837
    groupColor: "#FFFDF5",
    labelBorderTop: "1px solid black", // _themes.py:1847-1848
    headingAlign: "center", // _themes.py:1856
    stripe: "#F4F4F4", // _themes.py:1864
    titleSize: "18px", // _themes.py:1841
  });
});
test("sofa, swiss, terminal, tier, tufte spot values", () => {
  expect(tk("sofa")).toMatchObject({
    bg: "#F0EAD6", // _themes.py:1921
    text: "#333333", // great_tables' default text on the cream ground
    titleSize: "22px", // _themes.py:1928
    groupBorderBottom: "1px solid black", // _themes.py:1939-1941
  });
  expect(tk("sofa", { style: "dark" }).text).toBe("#FFFFFF"); // great_tables switches the text to white (docstring, _themes.py:1880)
  expect(tk("swiss")).toMatchObject({
    pad: "11px", // pad + 5: _themes.py:628
    labelPad: "8px", // pad + 2: _themes.py:638
    groupPad: "12px", // pad + 6: _themes.py:647
    titleSize: "30px", // title + 4: _themes.py:618
    labelTracking: "0.12em", // _themes.py:657
    labelBorderBottom: "1px solid #111111", // _themes.py:635-637
  });
  expect(tk("terminal", undefined, "compact")).toMatchObject({
    bg: "#0F1115", // _themes.py:1252
    tableBorderTop: "1px solid #ffb86c", // _themes.py:1273-1275
    tableBorderBottom: "1px solid #262B33", // _themes.py:1276-1278
    lineHeight: "1.5", // _themes.py:1306
    titleSize: "20px", // title - 2: _themes.py:1258
    titleTransform: "uppercase",
  });
  expect(tk("tier")).toMatchObject({
    bg: "#1a1a17", // _themes.py:2011
    text: "#FFFFFF", // great_tables' dark-ground text
    hline: "1px solid black", // _themes.py:2018
    pad: "1px", // _themes.py:2021
    titleWeight: "650", // _themes.py:2016
  });
  expect(tk("tier", { style: "light" })).toMatchObject({ bg: "#ffffff", text: "#333333" });
  expect(tk("tufte")).toMatchObject({
    bg: "#FFFFF8", // _themes.py:711
    labelStyle: "italic", // _themes.py:714
    labelSize: "12px", // label + 2
    bodySize: "15px", // body + 1: _themes.py:717
    bodyBorderBottom: "1px solid #C9C4B8", // _themes.py:751-753
  });
});
test("every color option of every themed table is validated", () => {
  for (const [name, arg] of [
    ["almanac", "accent"],
    ["booktabs", "accent"],
    ["brutalist", "accent"],
    ["scoreboard", "accent"],
    ["swiss", "accent"],
    ["terminal", "accent"],
    ["tufte", "accent"],
    ["broadsheet", "accent"],
    ["drench", "color"],
  ] as const)
    expect(() => tk(name, { [arg]: "blue" }), name).toThrow(new RegExp(`${arg} must be a hex color`));
  expect(() => tk("sofa", { style: "sepia" })).toThrow(/light.*dark/);
});
