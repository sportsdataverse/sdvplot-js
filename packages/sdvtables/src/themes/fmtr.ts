// src/themes/fmtr.ts — the 27 reactablefmtr themes (reactablefmtr 2.1.0, R/themes.R), registered as `fmtr-<name>`, and
// `fmtr-team`, the same look built from a team's colours. Every value is reactablefmtr's own, read by evaluating each
// theme function (defaults) under R 4.6.1 and printing its reactableTheme(); where a theme leaves a value unset, the
// reactable 0.4 stylesheet's default applies (td rule 1px #f2f2f2, header rule 2px #e6e6e6, header weight 600, a white
// ground). CSS colour names are written as their hex (grey #808080, lightgrey #d3d3d3, lightblue #add8e6, white).
// Values changed to pass sdvtables' contrast gate (test/a11y-contrast.test.ts) carry an `a11y:` comment naming the
// reactablefmtr value. reactable's `highlight = TRUE` hover becomes a fill on the engine's hovered row (tr.sdvt-hover),
// on by default in hoverdark/hoverlight; `striped = TRUE` is options.striped. Sizes are px at "comfortable", scaled by
// density like the hard-coded gtUtils themes.
import {
  LEAGUES,
  UnresolvedTeamError,
  contrast,
  mix,
  onColor,
  resolveSync,
  teamColorsSync,
  warn,
} from "@sportsdataverse/sdvplot";
import type { League } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import type { ThemeRef } from "../spec.js";
import { SDV_CYAN, SDV_NAVY } from "./sdv.js";
import {
  SYSTEM_FONTS,
  type Theme,
  type ThemeDef,
  baseTokens,
  densitySizes,
  hexOption,
  px,
  scaleFor,
} from "./tokens.js";

/** One reactablefmtr theme's reactableTheme() values (unset = reactable's stylesheet default). */
interface Fmtr {
  /** tableStyle fontSize (the `font_size` argument) */
  readonly font: number;
  /** color (`font_color`) */
  readonly color: string;
  /** headerStyle fontSize (`header_font_size`) */
  readonly headerSize: number;
  /** headerStyle color (`header_font_color`); unset = the body colour */
  readonly headerColor?: string;
  /** style backgroundColor, else backgroundColor (`background_color`); the container's ground */
  readonly bg?: string;
  /** cellPadding (`cell_padding`) */
  readonly pad: number;
  /** borderColor / borderWidth: the rule between rows ("none" = no rule) */
  readonly rule?: string;
  readonly ruleWidth?: number;
  readonly stripe?: string;
  readonly highlight?: string;
  readonly headerBg?: string;
  /**
   * the header's bottom rule: headerStyle borderWidth / borderBottomColor (or borderColor); "none" = no rule. reactable
   * takes an unset width from the theme's borderWidth, else its stylesheet's 2px; every theme that sets a borderWidth
   * also sets headerStyle's, so unset here means 2px.
   */
  readonly headerRuleWidth?: number;
  readonly headerRule?: string;
  readonly headerBorderTop?: string;
  readonly headerPad?: number;
  readonly headerWeight?: string;
  readonly upper?: boolean;
  readonly groupBg?: string;
  readonly groupColor?: string;
  readonly groupSize?: number;
  readonly groupUpper?: boolean;
  readonly groupWeight?: string;
  readonly groupBorderTop?: string;
  /**
   * the group heading's bottom rule, when it differs from the row rule: reactable draws it (the group header's ::after)
   * at the theme's borderWidth, else 1px, in the theme's borderColor, else #e6e6e6, so a cellStyle-only border (sanfran,
   * no_lines, void) or an unset one (default) does not reach it.
   */
  readonly groupRule?: string;
  /** declarations the token set cannot carry, scoped by `s`, lengths through `p` (density-scaled px) */
  readonly css?: (s: string, p: (n: number) => string) => readonly string[];
  /** tableBodyStyle backgroundImage */
  readonly bodyImage?: string;
  /** tableStyle borderBottom */
  readonly tableBottom?: string;
  /** cellStyle background */
  readonly cellBg?: string;
  readonly hover?: boolean;
}

const NONE = "none";
/** reactablefmtr name → values. The order is reactablefmtr's (alphabetical). */
export const FMTR: Readonly<Record<string, Fmtr>> = {
  cerulean: {
    font: 14,
    color: "#141415",
    headerSize: 15,
    headerColor: "#0e3b53", // a11y: reactablefmtr #cfe9f7 (2.07:1 on #3ba9e8; no lighter tint reaches 4.5:1)
    pad: 6,
    rule: "#e9ecef",
    ruleWidth: 1,
    stripe: "#e9ecef",
    highlight: "#e9ecef",
    headerBg: "#3ba9e8",
    headerRuleWidth: 2,
    headerRule: "#eaedf0",
  },
  clean: {
    font: 14,
    color: "#222222",
    headerSize: 15,
    headerColor: "#222222",
    pad: 6,
    rule: "#ffffff",
    stripe: "#e0e0e0",
    highlight: "#e0e0e0",
    headerRuleWidth: 2,
    headerRule: "#3b3b3b",
  },
  cosmo: {
    font: 14,
    color: "#141415",
    headerSize: 15,
    headerColor: "#ffffff",
    bg: "#f8f9fa",
    pad: 6,
    rule: "#f8f9fa",
    ruleWidth: 1,
    stripe: "#ffffff",
    highlight: "#ffffff",
    headerBg: "#373a3c",
    headerRuleWidth: 2,
  },
  cyborg: {
    font: 14,
    color: "#8e8e8e", // a11y: reactablefmtr #888888 (4.16:1 on the #282828 stripe)
    headerSize: 15,
    headerColor: "#7b7b7b",
    bg: "#060606",
    pad: 6,
    rule: "#888888",
    ruleWidth: 1,
    stripe: "#282828",
    highlight: "#282828",
    headerBg: "#060606",
    headerRuleWidth: 2,
  },
  dark: {
    font: 15,
    color: "#FFFFFF",
    headerSize: 16,
    headerColor: "#FFFFFF",
    bg: "#252525",
    pad: 6,
    rule: "#434343",
    ruleWidth: 1,
    stripe: "#303030",
    highlight: "#303030",
    headerBg: "#252525",
    headerRuleWidth: 2,
    headerRule: "#ececec",
    groupBg: "#252525",
    groupColor: "#FFFFFF",
    groupSize: 16,
  },
  darkly: {
    font: 14,
    color: "#ffffff",
    headerSize: 15,
    headerColor: "#c5cfda", // a11y: reactablefmtr #afbdcc (3.74:1 on #375a7f)
    bg: "#222222",
    pad: 6,
    rule: "#222222",
    ruleWidth: 1,
    stripe: "#70777e", // a11y: reactablefmtr #adb5bd (hover/selected bar 2.07:1, white type 2.07:1)
    highlight: "#70777e", // a11y: reactablefmtr #adb5bd (white type 2.07:1)
    headerBg: "#375a7f",
    headerRuleWidth: 2,
  },
  default: {
    font: 15,
    color: "#333333",
    headerSize: 15,
    headerColor: "#333333",
    pad: 6,
    groupColor: "#333333",
    groupSize: 15,
    groupRule: "1px solid #e6e6e6",
  },
  espn: {
    font: 12,
    color: "#59595b", // a11y: reactablefmtr #6C6D6F (filter-box border 2.61:1)
    headerSize: 11,
    headerColor: "#48494a",
    pad: 7,
    rule: "#ededed",
    ruleWidth: 1,
    stripe: "#fafafa",
    highlight: "#fafafa",
    headerBg: "#ffffff",
    headerRuleWidth: 1,
    headerRule: "#e1e2e4",
    headerBorderTop: "1px solid #e1e2e4",
    headerPad: 4,
    upper: true,
    groupBg: "#ffffff",
    groupColor: "#6C6D6F",
    groupSize: 11,
    groupUpper: true,
    groupBorderTop: "1px solid #e1e2e4",
    css: (s) => [`${s} th.sdvt-group{border-left:1px solid #e1e2e4;border-right:1px solid #e1e2e4}`],
  },
  fivethirtyeight: {
    font: 14,
    color: "#222222",
    headerSize: 12,
    headerColor: "#000000",
    pad: 5,
    rule: "#dddddd",
    ruleWidth: 1,
    stripe: "#dddddd",
    highlight: "#f0f0f0",
    headerBg: "#ffffff",
    headerRuleWidth: 3,
    headerRule: "#333333", // headerStyle names borderColor twice ("#222222", then "#333"): the later one wins
    upper: true,
    groupUpper: true,
    tableBottom: "3px solid #222222",
    // headerStyle paddingTop 12px + verticalAlign bottom; groupHeaderStyle paddingBottom 3px
    css: (s, p) => [
      `${s} th.sdvt-label{padding-top:${p(12)};vertical-align:bottom}`,
      `${s} th.sdvt-group{padding-bottom:${p(3)}}`,
    ],
  },
  flatly: {
    font: 14,
    color: "#212529",
    headerSize: 15,
    headerColor: "#ffffff",
    pad: 6,
    rule: "#ffffff",
    ruleWidth: 1,
    stripe: "#ecf0f1",
    highlight: "#ecf0f1",
    headerBg: "#2c3e50",
    headerRuleWidth: 2,
  },
  hoverdark: {
    font: 15,
    color: "#222222",
    headerSize: 15,
    pad: 4,
    rule: "#808080",
    ruleWidth: 1,
    stripe: "#D6D6D6",
    highlight: "#CACACA",
    headerRuleWidth: 2,
    hover: true,
  },
  hoverlight: {
    font: 15,
    color: "#ffffff",
    headerSize: 15,
    bg: "#000000",
    pad: 4,
    rule: "#808080",
    ruleWidth: 1,
    stripe: "#767676", // a11y: reactablefmtr #d3d3d3 (white type and bar 1.5:1)
    highlight: "#767676", // a11y: reactablefmtr #d3d3d3 (1.5:1)
    headerRuleWidth: 2,
    hover: true,
  },
  journal: {
    font: 14,
    color: "#222222",
    headerSize: 15,
    headerColor: "#76120f", // a11y: reactablefmtr #fad9d8 (1.90:1 on #ef8683; no lighter tint reaches 4.5:1)
    pad: 6,
    rule: "#aaaaaa",
    ruleWidth: 1,
    stripe: "#eeeeee",
    highlight: "#eeeeee",
    headerBg: "#ef8683",
    headerRuleWidth: 2,
  },
  lux: {
    font: 14,
    color: "#515151", // a11y: reactablefmtr #8c8c8c (filter-box border 2.0:1, selected bar 2.74:1)
    headerSize: 15,
    headerColor: "#828282", // a11y: reactablefmtr #7f7f7f (4.35:1 on #1a1a1a)
    pad: 6,
    rule: "#f7f7f9",
    ruleWidth: 1,
    stripe: "#dadada",
    highlight: "#f7f7f9",
    headerBg: "#1a1a1a",
    headerRuleWidth: 2,
    upper: true,
    groupUpper: true,
  },
  midnight: {
    font: 15,
    color: "#818181", // a11y: reactablefmtr #727272 (3.65:1 on the #191919 gradient stop, 4.37:1 on black)
    headerSize: 15,
    headerColor: "#757575", // a11y: reactablefmtr #666666 (3.66:1 on black)
    bg: "#000000",
    pad: 6,
    rule: NONE,
    stripe: "#001831", // a11y: reactablefmtr #00468c (hover/selected bar 1.71:1)
    highlight: "#001831", // a11y: reactablefmtr #00468c (1.71:1)
    headerBg: "#000000",
    headerRule: NONE,
    groupBg: "#000000",
    groupColor: "#818181", // a11y: reactablefmtr #727272 (4.37:1 on black), kept equal to the body type as in R
    groupSize: 15,
    bodyImage: "linear-gradient(#000000, #0d0d0d, #191919)",
  },
  midnightblue: {
    font: 15,
    color: "#bababa",
    headerSize: 15,
    headerColor: "#d3d3d3",
    bg: "#001021",
    pad: 6,
    rule: NONE,
    stripe: "#00468c",
    highlight: "#00468c",
    headerBg: "#001021",
    headerRuleWidth: 1,
    headerRule: "#001021",
    groupBg: "#001021",
    groupColor: "#bababa",
    groupSize: 15,
    bodyImage: "linear-gradient(#001021, #001c3a, #002853)",
  },
  minty: {
    font: 15,
    color: "#525252", // a11y: reactablefmtr #9a9a9a (filter-box border 1.84:1, selected bar 2.3:1)
    headerSize: 16,
    headerColor: "#234e41", // a11y: reactablefmtr #c9e7de (1.58:1 on #78c2ad; no lighter tint reaches 4.5:1)
    pad: 6,
    rule: "#f7f7f9",
    ruleWidth: 1,
    stripe: "#ededed",
    highlight: "#f7f7f9",
    headerBg: "#78c2ad",
    headerRuleWidth: 2,
  },
  no_lines: {
    font: 14,
    color: "#222222",
    headerSize: 15,
    headerColor: "#222222",
    pad: 6,
    rule: NONE,
    stripe: "#d3d3d3",
    highlight: "#d3d3d3",
    headerRule: NONE,
    groupRule: "1px solid #e6e6e6",
  },
  nytimes: {
    font: 13,
    color: "#333333",
    headerSize: 11,
    headerColor: "#767676", // a11y: reactablefmtr #999999 (2.85:1 on white)
    pad: 5,
    rule: "#e7e7e7",
    ruleWidth: 1,
    stripe: "#e7e7e7",
    highlight: "#eeeeee",
    headerBg: "#ffffff",
    headerRule: NONE,
    headerPad: 5,
    headerWeight: "500",
    upper: true,
    groupUpper: true,
    groupSize: 11,
  },
  pff: {
    font: 16,
    color: "#5a5f63", // a11y: reactablefmtr #878e94 (filter-box border 2.16:1, selected bar 2.71:1)
    headerSize: 12,
    headerColor: "#ffffff",
    pad: 4,
    rule: NONE,
    stripe: "#f9f9fb",
    highlight: "#f1f3f4",
    headerBg: "#595d63",
    headerRuleWidth: 1,
    headerRule: "#595d63",
    headerBorderTop: "1px solid #595d63",
    headerPad: 7,
    headerWeight: "bold",
    upper: true,
    groupBg: "#e4e8ed",
    groupColor: "#63696f", // a11y: reactablefmtr #878e94 (2.70:1 on #e4e8ed)
    groupWeight: "bold",
    groupUpper: true,
    css: (s) => [`${s} th.sdvt-group{box-shadow:inset 3px 0 0 0 #ffffff}`],
  },
  sandstone: {
    font: 15,
    color: "#3e3f3a",
    headerSize: 16,
    headerColor: "#72706e", // a11y: reactablefmtr #7c7a78 (3.93:1 on #f8f5f0)
    pad: 6,
    rule: "#f8f5f0",
    ruleWidth: 1,
    stripe: "#ededed",
    highlight: "#f8f5f0",
    headerBg: "#f8f5f0",
    headerRuleWidth: 2,
  },
  sanfran: {
    font: 14,
    color: "#222222",
    headerSize: 15,
    headerColor: "#212121",
    pad: 6,
    rule: "#ffffff", // cellStyle borderColor; borderWidth 6: tiles on a white ground
    ruleWidth: 6,
    stripe: "#d3d3d3",
    highlight: "#d3d3d3",
    headerRule: "#f5f5f5",
    groupRule: "1px solid #f5f5f5",
    cellBg: "#f5f5f5",
  },
  slate: {
    font: 15,
    color: "#b8b8b8", // a11y: reactablefmtr #aaaaaa (3.85:1 on the #464a4d stripe)
    headerSize: 16,
    headerColor: "#a7a9ab", // a11y: reactablefmtr #97999b (3.72:1 on #3a3f44)
    bg: "#272b30",
    pad: 6,
    rule: "#272b30",
    ruleWidth: 1,
    stripe: "#464a4d",
    highlight: "#464a4d",
    headerBg: "#3a3f44",
    headerRuleWidth: 2,
  },
  spacelab: {
    font: 14,
    color: "#585858", // a11y: reactablefmtr #8e8e8e (filter-box border 2.07:1, selected bar 2.67:1)
    headerSize: 15,
    headerColor: "#6b6b6b", // a11y: reactablefmtr #8e8e8e (2.80:1 on #ededed)
    pad: 6,
    rule: "#eeeeee",
    ruleWidth: 1,
    stripe: "#dadada",
    highlight: "#dadada",
    headerBg: "#ededed",
    headerRuleWidth: 2,
  },
  sunrise: {
    font: 15,
    color: "#403480", // a11y: reactablefmtr #8069ff (filter-box border 2.22:1, selected bar 2.95:1, 1.69:1 on the #f98d77 gradient stop)
    headerSize: 15,
    headerColor: "#6b51ff", // a11y: reactablefmtr #8069ff (3.58:1 on #fffa85)
    bg: "#fffa85",
    pad: 6,
    rule: NONE,
    stripe: "#add8e6",
    highlight: "#ffffff",
    headerBg: "#fffa85",
    headerRuleWidth: 1,
    headerRule: "#fffa85",
    groupBg: "#fffa85",
    bodyImage: "linear-gradient(#fffa85, #ffe269, #ffcb69, #f98d77)",
  },
  superhero: {
    font: 14,
    color: "#ebebeb",
    headerSize: 15,
    headerColor: "#ebebeb",
    bg: "#2b3e50",
    pad: 6,
    rule: "#2b3e50",
    ruleWidth: 1,
    stripe: "#4a5969",
    highlight: "#4a5969",
    headerBg: "#4e5d6c",
    headerRuleWidth: 2,
  },
  void: {
    font: 14,
    color: "#222222",
    headerSize: 15,
    headerColor: "transparent", // void hides the column labels (they stay in the markup for screen readers)
    pad: 6,
    rule: NONE,
    stripe: "#d3d3d3",
    highlight: "#d3d3d3",
    headerRule: NONE,
    groupRule: "1px solid #e6e6e6",
  },
};

/** The 27 reactablefmtr theme names, as reactablefmtr spells them (`no_lines` has an underscore). */
export const FMTR_NAMES: readonly string[] = Object.keys(FMTR);
/** reactablefmtr name → sdvtables theme name: `fmtr-<name>`, underscores as hyphens (`no_lines` → `fmtr-no-lines`). */
export const fmtrThemeName = (name: string): string => `fmtr-${name.replace(/_/g, "-")}`;

const num = (v: string | undefined, arg: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0)
    throw new TableSpecError(`${arg} must be a non-negative number, not "${v}"`);
  return n;
};
const flag = (v: string | undefined, arg: string, dflt: boolean): boolean => {
  if (v === undefined) return dflt;
  if (v !== "true" && v !== "false") throw new TableSpecError(`${arg} must be "true" or "false", not "${v}"`);
  return v === "true";
};

/**
 * One theme from reactablefmtr values. Options are the theme function's own arguments (`fontSize`, `fontColor`,
 * `headerFontSize`, `headerFontColor`, `backgroundColor`, `cellPadding`) plus reactable's `striped` and `highlight`
 * ("true"/"false").
 */
function build(name: string, f: Fmtr, ref: ThemeRef): Theme {
  const o = ref.options ?? {};
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const opt = (key: string): string | undefined =>
    o[key] === undefined ? undefined : hexOption(o[key], key);
  const color = opt("fontColor") ?? f.color;
  const bg = opt("backgroundColor") ?? f.bg ?? "#ffffff";
  const font = num(o.fontSize, "fontSize") ?? f.font;
  const headerSize = num(o.headerFontSize, "headerFontSize") ?? f.headerSize;
  const pad = num(o.cellPadding, "cellPadding") ?? f.pad;
  const striped = flag(o.striped, "striped", false);
  const highlight = flag(o.highlight, "highlight", f.hover === true);
  const body = (n: number): string => px(n * k.body);
  const p = (n: number): string => px(n * k.pad);
  const rule = f.rule ?? "#f2f2f2";
  const hline = rule === NONE ? NONE : `${px(f.ruleWidth ?? 1)} solid ${rule}`;
  const headerRule = f.headerRule ?? (f.rule === NONE ? NONE : (f.rule ?? "#e6e6e6"));
  const labelBorderBottom = headerRule === NONE ? NONE : `${px(f.headerRuleWidth ?? 2)} solid ${headerRule}`;
  const labelBg = f.headerBg ?? bg;
  return {
    name,
    tokens: {
      ...baseTokens(d, SYSTEM_FONTS),
      bg,
      text: color,
      muted: color,
      accent: f.headerBg ?? color,
      rule: rule === NONE ? "#e6e6e6" : rule,
      hline,
      headingBg: bg,
      labelBg,
      labelColor: opt("headerFontColor") ?? f.headerColor ?? color,
      labelWeight: f.headerWeight ?? "600",
      labelSize: body(headerSize),
      labelTransform: f.upper ? "uppercase" : "none",
      labelBorderTop: f.headerBorderTop ?? NONE,
      labelBorderBottom,
      labelPad: p(f.headerPad ?? pad),
      groupBg: f.groupBg ?? bg,
      groupColor: f.groupColor ?? color,
      groupWeight: f.groupWeight ?? "600",
      groupSize: body(f.groupSize ?? headerSize),
      groupTransform: f.groupUpper ? "uppercase" : "none",
      groupBorderTop: f.groupBorderTop ?? NONE,
      groupBorderBottom: f.groupRule ?? hline,
      groupPad: p(pad),
      bodySize: body(font),
      pad: p(pad),
      headingPad: p(pad),
      sourcePad: p(pad),
      tableBorderBottom: f.tableBottom ?? NONE,
      stripe: striped && f.stripe ? f.stripe : "transparent",
      sourceColor: color,
      sourceSize: px(d.source),
    },
    fonts: [],
    rules: (s) =>
      [
        // reactable pads a cell on every side (cellPadding); the base sheet pads only top and bottom from the token
        `${s} td.sdvt-cell{padding-left:${p(pad)};padding-right:${p(pad)}}`,
        `${s} th.sdvt-label{padding-left:${p(f.headerPad ?? pad)};padding-right:${p(f.headerPad ?? pad)}}`,
        f.bodyImage ? `${s} tbody{background-image:${f.bodyImage}}` : "",
        f.cellBg ? `${s} td.sdvt-cell{background-color:${f.cellBg}}` : "",
        highlight && f.highlight ? `${s} tr.sdvt-hover>td.sdvt-cell{background-color:${f.highlight}}` : "",
        ...(f.css?.(s, p) ?? []),
      ]
        .filter(Boolean)
        .join("\n"),
  };
}

/** The 27 reactablefmtr themes, keyed by their sdvtables names (`fmtr-espn`, `fmtr-no-lines`, ...). */
export const FMTR_THEMES: Readonly<Record<string, ThemeDef>> = Object.fromEntries(
  FMTR_NAMES.map((n) => {
    const name = fmtrThemeName(n);
    return [name, (ref: ThemeRef): Theme => build(name, FMTR[n] as Fmtr, ref)];
  }),
);

/**
 * `fmtr-team`: reactablefmtr's `default` look with the header filled in a team's primary colour (options `league`,
 * `team`). The header ink is `onColor(primary)`; the header's bottom rule is the secondary colour unless it is too
 * pale on the table background (under 1.5:1, as sdvTeam), then the primary; the stripe and hover fills are tints of
 * the primary over the background that keep the body type above 4.5:1. Both checks use the `fontColor` and
 * `backgroundColor` overrides when given. No team: the SportsDataverse navy and cyan. A `league` without a `team`,
 * or a league sdvplot does not know, is a TableSpecError.
 */
export const fmtrTeam: ThemeDef = (ref) => {
  let primary = SDV_NAVY;
  let secondary = SDV_CYAN;
  const team = ref.options?.team;
  const leagueOpt = ref.options?.league;
  if (leagueOpt !== undefined && !(LEAGUES as readonly string[]).includes(leagueOpt))
    throw new TableSpecError(
      `fmtr-team options.league must be one of ${LEAGUES.join(", ")}, not "${leagueOpt}"`,
    );
  if (leagueOpt !== undefined && !team)
    throw new TableSpecError(
      `fmtr-team options.league "${leagueOpt}" needs options.team (e.g. { league: "nfl", team: "KC" })`,
    );
  if (team) {
    const league = leagueOpt as League | undefined;
    if (!league)
      throw new TableSpecError(
        'fmtr-team needs options.league with a team (e.g. { league: "nfl", team: "KC" })',
      );
    const id = resolveSync(team, league, { strict: true });
    if (!id) throw new UnresolvedTeamError(`${team} is not a ${league} team`);
    const p = teamColorsSync(league, id);
    if (p) {
      primary = p;
      secondary = teamColorsSync(league, id, { which: "secondary" }) ?? p;
    } else
      warn(
        `sdvtables:fmtr-team:${league}:${team}`,
        `no colors on file for ${league} team "${team}"; using the SportsDataverse colors`,
      );
  }
  const base = FMTR.default as Fmtr;
  const o = ref.options ?? {};
  // the colours the table really paints, so the checks below follow the fontColor / backgroundColor overrides
  const text = o.fontColor === undefined ? base.color : hexOption(o.fontColor, "fontColor");
  const ground =
    o.backgroundColor === undefined ? "#ffffff" : hexOption(o.backgroundColor, "backgroundColor");
  const tint = (t: number): string => {
    // the strongest tint of the primary at or below weight t that keeps the body type at 4.5:1, else the ground
    for (let w = t; w > 0; w -= 0.01) {
      const c = mix(ground, primary, w);
      if (contrast(text, c) >= 4.5) return c;
    }
    return ground;
  };
  return build(
    "fmtr-team",
    {
      ...base,
      headerBg: primary,
      headerColor: onColor(primary),
      headerRuleWidth: 3,
      headerRule: contrast(secondary, ground) >= 1.5 ? secondary : primary,
      stripe: tint(0.08),
      highlight: tint(0.16),
      groupBg: tint(0.12),
    },
    ref,
  );
};
