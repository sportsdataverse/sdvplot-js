// src/themes/sdv.ts — port of _marks._light_palette/_dark_palette/_build_theme/gt_theme_sdv_team
import {
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
import {
  type Theme,
  type ThemeTokens,
  baseTokens,
  border,
  densitySizes,
  fontStack,
  px,
  scaleFor,
} from "./tokens.js";
export const SDV_NAVY = "#0B1A33";
export const SDV_CYAN = "#7FE6DC";
export const SDV_HORIZON = "linear-gradient(90deg, #3346F0, #7FE6DC)";
interface Pal {
  bg: string;
  headingBg: string;
  title: string;
  subtitle?: string;
  muted: string;
  label: string;
  text: string;
  rule: string;
  groupBg: string;
  horizon: string;
}
const light = (horizon: string): Pal => ({
  bg: "#FFFFFF",
  headingBg: "#FFFFFF",
  title: SDV_NAVY,
  muted: "#4A5A75",
  label: "#16305C",
  text: SDV_NAVY,
  rule: "#E3E8F1",
  groupBg: "#EEF3FA",
  horizon,
});
const dark = (): Pal => ({
  bg: SDV_NAVY,
  headingBg: SDV_NAVY,
  title: "#FFFFFF",
  muted: "#A9B8D0",
  label: "#9CCBFF",
  text: "#EAEBEC",
  rule: "#1D3A66",
  groupBg: "#16305C",
  horizon: SDV_HORIZON,
});
/** sdvplotR .theme_secondary_on() (_marks.py:619-628): fg blended toward bg as far as still clears 4.5:1 (weights 0.45 + i*0.05, unrounded). */
export function secondaryOn(bg: string, fg: string, target = 4.5): string {
  for (let i = 0; i < 12; i++) {
    const c = mix(bg, fg, 0.45 + i * 0.05);
    if (contrast(c, bg) >= target) return c;
  }
  return fg;
}
function build(name: string, ref: ThemeRef, pal: Pal): Theme {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: keyof typeof k): string => px(n * k[role]);
  const t: ThemeTokens = {
    ...baseTokens(d, fontStack("Lato")),
    fontLabel: fontStack("Chivo"),
    fontTitle: fontStack("Chivo"),
    bg: pal.bg,
    text: pal.text,
    muted: pal.muted,
    accent: pal.label,
    rule: pal.rule,
    hline: border(1, pal.rule),
    headingBg: pal.headingBg,
    titleColor: pal.title,
    titleWeight: "800",
    titleSize: sz(22, "title"),
    subtitleColor: pal.subtitle ?? pal.muted,
    subtitleSize: sz(14, "subtitle"),
    labelBg: pal.bg,
    labelColor: pal.label,
    labelWeight: "500",
    labelSize: sz(13, "label"),
    groupBg: pal.groupBg,
    groupColor: pal.label,
    groupWeight: "500",
    groupSize: sz(13, "group"),
    bodySize: sz(15, "body"),
    pad: sz(7, "pad"),
    headingPad: sz(4, "pad"),
    labelPad: sz(6, "pad"),
    groupPad: sz(8, "pad"),
    sourcePad: sz(4, "pad"),
    sourceColor: pal.muted,
    sourceSize: sz(12, "source"),
    horizon: pal.horizon,
  };
  return {
    name,
    tokens: t,
    fonts: [
      { family: "Chivo", weights: [500, 800] },
      { family: "Lato", weights: [400, 700] },
    ],
    rules: (s) =>
      [
        `${s} th.sdvt-label{padding-bottom:10px}`,
        `${s} caption,${s} tfoot td,${s} th.sdvt-label:first-child,${s} td.sdvt-cell:first-child{padding-left:14px}`,
        `${s} caption,${s} tfoot td,${s} th.sdvt-label:last-child,${s} td.sdvt-cell:last-child{padding-right:14px}`,
        `${s} .sdvt-title{padding-top:12px;display:block}${s} .sdvt-subtitle{padding-bottom:12px;display:block}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${pal.bg}}`,
      ].join("\n"),
  };
}
export const sdv = (ref: ThemeRef): Theme => {
  const style = ref.options?.style ?? "light";
  if (style !== "light" && style !== "dark")
    throw new TableSpecError(`sdv theme style must be "light" or "dark", not "${style}"`);
  return build("sdv", ref, style === "dark" ? dark() : light(SDV_HORIZON));
};
export const sdvTeam = (ref: ThemeRef): Theme => {
  const league = ref.options?.league as League | undefined;
  if (!league) throw new TableSpecError('sdvTeam needs options.league (e.g. { league: "nfl", team: "KC" })');
  let primary = SDV_NAVY;
  let secondary = SDV_CYAN;
  const team = ref.options?.team;
  if (team) {
    const id = resolveSync(team, league, { strict: true });
    if (!id) throw new UnresolvedTeamError(`${team} is not a ${league} team`);
    const p = teamColorsSync(league, id);
    const s = teamColorsSync(league, id, { which: "secondary" });
    if (p) {
      primary = p;
      secondary = s ?? p;
    } else
      warn(
        `sdvtables:sdvTeam:${league}:${team}`,
        `no colors on file for ${league} team "${team}"; using the SportsDataverse colors`,
      ); // _marks.py:819-820
  }
  const title = onColor(primary);
  const pal = light(contrast(secondary, "#ffffff") >= 1.5 ? secondary : primary);
  return build("sdvTeam", ref, {
    ...pal,
    headingBg: primary,
    title,
    subtitle: secondaryOn(primary, title),
    label: contrast(primary, "#ffffff") >= 3 ? primary : SDV_NAVY,
  });
};
