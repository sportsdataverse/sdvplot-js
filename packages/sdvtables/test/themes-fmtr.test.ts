// The reactablefmtr themes: values read from reactablefmtr 2.1.0 (R 4.6.1, each theme function's reactableTheme()).
import { contrast, onColor, preloadAll } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { GT_ALIASES } from "../src/aliases.js";
import { defineTable } from "../src/define.js";
import { TableSpecError } from "../src/errors.js";
import { renderHTML } from "../src/html/index.js";
import { FMTR_NAMES, fmtrThemeName } from "../src/themes/fmtr.js";
import { FMTR_THEME_NAMES, THEME_NAMES, resolveTheme } from "../src/themes/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

beforeAll(() => preloadAll());
const th = (
  name: string,
  options?: Record<string, string>,
  density: "comfortable" | "compact" = "comfortable",
) => resolveTheme({ name, density, ...(options ? { options } : {}) });

test("all 27 reactablefmtr themes are registered as fmtr-<name>, aliased by their reactablefmtr names", () => {
  expect(FMTR_NAMES).toHaveLength(27);
  expect(FMTR_THEME_NAMES).toEqual(FMTR_NAMES.map(fmtrThemeName));
  expect(FMTR_THEME_NAMES).toContain("fmtr-no-lines");
  for (const n of FMTR_NAMES) {
    expect(THEME_NAMES).toContain(fmtrThemeName(n));
    expect(GT_ALIASES[n]?.target).toBe(`theme.${fmtrThemeName(n)}`);
  }
  expect(THEME_NAMES).toContain("fmtr-team");
  expect(THEME_NAMES).toContain("midnight"); // the house theme is untouched
  expect(th("fmtr-midnight").name).toBe("fmtr-midnight");
});

test("espn, nytimes, fivethirtyeight, pff spot values", () => {
  expect(th("fmtr-espn").tokens).toMatchObject({
    bodySize: "12px",
    labelSize: "11px",
    labelColor: "#48494a",
    labelTransform: "uppercase",
    labelBorderTop: "1px solid #e1e2e4",
    labelBorderBottom: "1px solid #e1e2e4",
    labelPad: "4px",
    hline: "1px solid #ededed",
    pad: "7px",
    bg: "#ffffff",
  });
  expect(th("fmtr-nytimes").tokens).toMatchObject({
    text: "#333333",
    labelColor: "#767676", // a11y: reactablefmtr #999999
    labelWeight: "500",
    groupTransform: "uppercase",
    labelBorderBottom: "none",
    bodySize: "13px",
    hline: "1px solid #e7e7e7",
  });
  expect(th("fmtr-fivethirtyeight").tokens).toMatchObject({
    labelBorderBottom: "3px solid #333333",
    tableBorderBottom: "3px solid #222222",
    labelColor: "#000000",
    labelSize: "12px",
    groupTransform: "uppercase",
  });
  expect(th("fmtr-fivethirtyeight").rules("#t")).toContain(
    "#t th.sdvt-label{padding-top:12px;vertical-align:bottom}",
  );
  expect(th("fmtr-espn").tokens.groupBorderTop).toBe("1px solid #e1e2e4");
  expect(th("fmtr-espn").rules("#t")).toContain(
    "#t th.sdvt-group{border-left:1px solid #e1e2e4;border-right:1px solid #e1e2e4}",
  );
  expect(th("fmtr-pff").tokens).toMatchObject({
    labelBg: "#595d63",
    labelColor: "#ffffff",
    labelWeight: "bold",
    labelBorderTop: "1px solid #595d63",
    hline: "none",
    bodySize: "16px",
    pad: "4px",
    // groupHeaderStyle: #e4e8ed band, bold uppercase (ink a11y-darkened from #878e94)
    groupBg: "#e4e8ed",
    groupColor: "#63696f",
    groupWeight: "bold",
    groupTransform: "uppercase",
    groupSize: "12px",
  });
  expect(th("fmtr-pff").rules("#t")).toContain("#t th.sdvt-group{box-shadow:inset 3px 0 0 0 #ffffff}");
});

test("dark grounds, gradients, tiles and hidden lines", () => {
  expect(th("fmtr-dark").tokens).toMatchObject({
    bg: "#252525",
    text: "#FFFFFF",
    labelBorderBottom: "2px solid #ececec",
  });
  const mid = th("fmtr-midnight");
  expect(mid.tokens).toMatchObject({
    bg: "#000000",
    text: "#818181", // a11y: reactablefmtr #727272
    hline: "none",
    labelBorderBottom: "none",
  });
  expect(mid.rules("#t")).toContain("#t tbody{background-image:linear-gradient(#000000, #0d0d0d, #191919)}");
  expect(th("fmtr-sunrise").rules("#t")).toContain("linear-gradient(#fffa85, #ffe269, #ffcb69, #f98d77)");
  const sf = th("fmtr-sanfran");
  expect(sf.tokens.hline).toBe("6px solid #ffffff");
  // the cell border width is cellStyle-only: the header keeps reactable's 2px, the group rule its 1px
  expect(sf.tokens.labelBorderBottom).toBe("2px solid #f5f5f5");
  expect(sf.tokens.groupBorderBottom).toBe("1px solid #f5f5f5");
  expect(sf.rules("#t")).toContain("#t td.sdvt-cell{background-color:#f5f5f5}");
  expect(th("fmtr-no-lines").tokens).toMatchObject({ hline: "none", labelBorderBottom: "none" });
  expect(th("fmtr-void").tokens).toMatchObject({ labelColor: "transparent", hline: "none" });
  expect(th("fmtr-default").tokens).toMatchObject({
    hline: "1px solid #f2f2f2", // reactable's stylesheet default
    labelBorderBottom: "2px solid #e6e6e6",
    labelWeight: "600",
  });
});

test("striped and highlight are opt-in like reactable's; hover themes highlight by default on the engine's hovered row", () => {
  expect(th("fmtr-flatly").tokens.stripe).toBe("transparent");
  expect(th("fmtr-flatly", { striped: "true" }).tokens.stripe).toBe("#ecf0f1");
  expect(th("fmtr-flatly").rules("#t")).not.toContain("sdvt-hover");
  expect(th("fmtr-flatly", { highlight: "true" }).rules("#t")).toContain(
    "#t tr.sdvt-hover>td.sdvt-cell{background-color:#ecf0f1}",
  );
  expect(th("fmtr-hoverdark").rules("#t")).toContain("tr.sdvt-hover>td.sdvt-cell{background-color:#CACACA}");
  expect(th("fmtr-hoverdark", { highlight: "false" }).rules("#t")).not.toContain("sdvt-hover");
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .theme("fmtr-cosmo", { options: { striped: "true" } })
      .build(),
    STANDINGS,
  );
  expect(html).toContain('data-sdvt-theme="fmtr-cosmo"');
  expect(html).toContain("sdvt-stripe");
});

test("the theme function's arguments are options, validated; sizes follow density", () => {
  expect(
    th("fmtr-espn", {
      fontSize: "16",
      fontColor: "#111111",
      headerFontSize: "18",
      headerFontColor: "#000000",
      backgroundColor: "#FAFAFA",
      cellPadding: "10",
    }).tokens,
  ).toMatchObject({
    bodySize: "16px",
    text: "#111111",
    labelSize: "18px",
    labelColor: "#000000",
    bg: "#fafafa",
    pad: "10px",
  });
  expect(th("fmtr-espn", undefined, "compact").tokens.bodySize).toBe("10.3px"); // 12 * 12/14
  expect(() => th("fmtr-espn", { fontColor: "grey" })).toThrow(/fontColor must be a hex color/);
  expect(() => th("fmtr-espn", { fontSize: "big" })).toThrow(/fontSize must be a non-negative number/);
  expect(() => th("fmtr-espn", { striped: "yes" })).toThrow(/striped must be "true" or "false"/);
});

test("a11y adjustments move only the values that failed the contrast gate (see the a11y: comments)", () => {
  expect(th("fmtr-minty").tokens.text).toBe("#525252"); // reactablefmtr #9a9a9a
  expect(th("fmtr-minty").tokens).toMatchObject({ labelColor: "#c9e7de", labelBg: "#326e5d" }); // light labels kept, fill darkened from #78c2ad
  expect(th("fmtr-hoverlight").rules("#t")).toContain("background-color:#767676"); // reactablefmtr lightgrey
  expect(th("fmtr-cerulean").tokens.text).toBe("#141415"); // untouched
});

test("fmtr-team: KC primary header with readable ink, secondary rule, tints that keep the body type at 4.5:1", () => {
  const kc = th("fmtr-team", { league: "nfl", team: "KC", striped: "true", highlight: "true" });
  expect(kc.tokens.labelBg).toBe("#e31837");
  expect(kc.tokens.labelColor).toBe(onColor("#e31837"));
  expect(kc.tokens.labelBorderBottom).toBe("3px solid #ffb612");
  expect(contrast("#333333", kc.tokens.stripe)).toBeGreaterThanOrEqual(4.5);
  expect(kc.rules("#t")).toMatch(/tr\.sdvt-hover>td\.sdvt-cell\{background-color:#[0-9a-f]{6}\}/);
  const lar = th("fmtr-team", { league: "nfl", team: "LAR" }); // pale secondary (1.46:1 on white): rule in primary
  expect(lar.tokens.labelBorderBottom).toBe("3px solid #003594");
  expect(th("fmtr-team").tokens.labelBg).toBe("#0B1A33"); // no team: SportsDataverse navy
  expect(() => th("fmtr-team", { team: "KC" })).toThrow(/league/);
  expect(() => th("fmtr-team", { league: "nfl", team: "ZZZ" })).toThrow(/ZZZ/);
  expect(() => th("fmtr-team", { league: "nfx", team: "KC" })).toThrow(TableSpecError);
  expect(() => th("fmtr-team", { league: "nfl" })).toThrow(TableSpecError);
});

test("fmtr-team checks the colours it paints: a fontColor / backgroundColor override moves the tints and the rule", () => {
  const dark = th("fmtr-team", {
    league: "nfl",
    team: "KC",
    striped: "true",
    fontColor: "#ffffff",
    backgroundColor: "#111111",
  });
  expect(contrast("#ffffff", dark.tokens.stripe)).toBeGreaterThanOrEqual(4.5);
  expect(dark.tokens.stripe).not.toBe("#ffffff");
  expect(contrast(dark.tokens.groupColor, dark.tokens.groupBg)).toBeGreaterThanOrEqual(4.5);
  // LAR's pale secondary is too pale on white, not on a dark ground
  const lar = th("fmtr-team", { league: "nfl", team: "LAR", backgroundColor: "#111111" });
  expect(lar.tokens.labelBorderBottom).not.toBe("3px solid #003594");
});
