// src/themes/tokens.ts
import { hex6 } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import { pxOf } from "../format.js";
import type { Density, ThemeRef } from "../spec.js";
export type Role = "body" | "pad" | "title" | "subtitle" | "label" | "group" | "source";
export type DensitySizes = Readonly<Record<Role, number>>;
export const DENSITY: Readonly<Record<Density, DensitySizes>> = {
  // sdvplotR utils-theme.R .theme_density() = _marks.py DENSITY
  comfortable: { body: 14, pad: 6, title: 26, subtitle: 15, label: 10, group: 11, source: 11 },
  compact: { body: 12, pad: 3, title: 22, subtitle: 13, label: 9, group: 10, source: 10 },
  social: { body: 17, pad: 9, title: 34, subtitle: 19, label: 12, group: 13, source: 13 },
};
export function densitySizes(d: Density): DensitySizes {
  const s = DENSITY[d];
  if (!s) throw new TableSpecError(`density must be comfortable, compact or social, not ${String(d)}`);
  return s;
}
/** Multipliers against "comfortable" — sdvplotR .theme_density_mult(), for themes that hard-code px sizes. */
export function scaleFor(d: Density): Readonly<Record<Role, number>> {
  const b = DENSITY.comfortable;
  const s = densitySizes(d);
  return {
    body: s.body / b.body,
    pad: s.pad / b.pad,
    title: s.title / b.title,
    subtitle: s.subtitle / b.subtitle,
    label: s.label / b.label,
    group: s.group / b.group,
    source: s.source / b.source,
  };
}
export const px: (n: number) => string = pxOf;
/** Python `_color` (_themes.py:85-90): a color option must be opaque hex; returns lowercase `#rrggbb`, else TableSpecError. */
export function hexOption(value: string, arg: string): string {
  try {
    return hex6(value);
  } catch {
    throw new TableSpecError(
      `${arg} must be a hex color with no transparency, such as '#8C2F1E', not "${value}"`,
    );
  }
}
export interface GoogleFont {
  readonly family: string;
  readonly weights: readonly number[];
  readonly italic?: boolean;
}
export interface ThemeTokens {
  fontBody: string;
  fontLabel: string;
  fontTitle: string;
  bg: string;
  text: string;
  muted: string;
  accent: string;
  rule: string;
  hline: string;
  headingBg: string;
  headingAlign: "left" | "center";
  titleColor: string;
  titleWeight: string;
  titleSize: string;
  titleTransform: string;
  titleTracking: string;
  subtitleColor: string;
  subtitleSize: string;
  subtitleStyle: string;
  subtitleWeight: string;
  labelBg: string;
  labelColor: string;
  labelWeight: string;
  labelSize: string;
  labelTransform: string;
  labelTracking: string;
  labelStyle: string;
  labelBorderTop: string;
  labelBorderBottom: string;
  groupBg: string;
  groupColor: string;
  groupWeight: string;
  groupSize: string;
  groupTransform: string;
  groupBorderTop: string;
  groupBorderBottom: string;
  bodySize: string;
  bodyWeight: string;
  pad: string;
  lineHeight: string;
  bodyBorderBottom: string;
  tableBorderTop: string;
  tableBorderBottom: string;
  tableBorderX: string;
  stripe: string;
  sourceColor: string;
  sourceSize: string;
  sourceStyle: string;
  horizon: string;
}
export const TOKEN_KEYS: readonly (keyof ThemeTokens)[] = [
  "fontBody",
  "fontLabel",
  "fontTitle",
  "bg",
  "text",
  "muted",
  "accent",
  "rule",
  "hline",
  "headingBg",
  "headingAlign",
  "titleColor",
  "titleWeight",
  "titleSize",
  "titleTransform",
  "titleTracking",
  "subtitleColor",
  "subtitleSize",
  "subtitleStyle",
  "subtitleWeight",
  "labelBg",
  "labelColor",
  "labelWeight",
  "labelSize",
  "labelTransform",
  "labelTracking",
  "labelStyle",
  "labelBorderTop",
  "labelBorderBottom",
  "groupBg",
  "groupColor",
  "groupWeight",
  "groupSize",
  "groupTransform",
  "groupBorderTop",
  "groupBorderBottom",
  "bodySize",
  "bodyWeight",
  "pad",
  "lineHeight",
  "bodyBorderBottom",
  "tableBorderTop",
  "tableBorderBottom",
  "tableBorderX",
  "stripe",
  "sourceColor",
  "sourceSize",
  "sourceStyle",
  "horizon",
];
export interface Theme {
  readonly name: string;
  readonly tokens: ThemeTokens;
  readonly fonts: readonly GoogleFont[] /** extra scoped rules; `sel` is `#<tableId>` */;
  readonly rules: (sel: string) => string;
}
export type ThemeDef = (ref: ThemeRef) => Theme;
/** Tokens every theme starts from; a theme overrides what it sets, so a forgotten key is "no rule", never undefined. */
export function baseTokens(d: DensitySizes, font: string): ThemeTokens {
  return {
    fontBody: font,
    fontLabel: font,
    fontTitle: font,
    bg: "#FFFFFF",
    text: "#333333",
    muted: "#5A5A5A",
    accent: "#333333",
    rule: "#D3D3D3",
    hline: "none",
    headingBg: "transparent",
    headingAlign: "left",
    titleColor: "inherit",
    titleWeight: "700",
    titleSize: px(d.title),
    titleTransform: "none",
    titleTracking: "normal",
    subtitleColor: "inherit",
    subtitleSize: px(d.subtitle),
    subtitleStyle: "normal",
    subtitleWeight: "400",
    labelBg: "transparent",
    labelColor: "inherit",
    labelWeight: "700",
    labelSize: px(d.label),
    labelTransform: "none",
    labelTracking: "normal",
    labelStyle: "normal",
    labelBorderTop: "none",
    labelBorderBottom: "none",
    groupBg: "transparent",
    groupColor: "inherit",
    groupWeight: "700",
    groupSize: px(d.group),
    groupTransform: "none",
    groupBorderTop: "none",
    groupBorderBottom: "none",
    bodySize: px(d.body),
    bodyWeight: "400",
    pad: px(d.pad),
    lineHeight: "normal",
    bodyBorderBottom: "none",
    tableBorderTop: "none",
    tableBorderBottom: "none",
    tableBorderX: "none",
    stripe: "transparent",
    sourceColor: "inherit",
    sourceSize: px(d.source),
    sourceStyle: "normal",
    horizon: "none",
  };
}
export const SYSTEM_FONTS =
  "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"; // _marks.R_FONTS
export const fontStack = (family: string): string => `'${family}', ${SYSTEM_FONTS}`;
export const border = (w: number, color: string, style = "solid"): string => `${px(w)} ${style} ${color}`;
