// src/themes/broadsheet.ts — gt_theme_broadsheet (_themes.py:451-571): a serif body on warm paper, small letterspaced sans labels, hairlines
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
const PAPER: Readonly<Record<string, readonly [string, string]>> = {
  white: ["#FBFAF7", "#DEDAD2"],
  salmon: ["#FFF1E5", "#EAD9C7"],
};
export const broadsheet = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#A6081A", "accent");
  const paper = ref.options?.paper ?? "white";
  const [bg, rule] = PAPER[paper] ?? [hexOption(paper, "paper"), "#DEDAD2"];
  const ink = "#16130F";
  const secondary = "#5C574F";
  const sans = fontStack("Public Sans");
  return {
    name: "broadsheet",
    tokens: {
      ...baseTokens(d, fontStack("Source Serif 4")),
      fontTitle: fontStack("Newsreader"),
      fontLabel: sans,
      bg,
      text: ink,
      muted: secondary,
      accent,
      rule,
      hline: border(1, rule),
      headingBg: bg,
      titleColor: ink,
      titleWeight: "600",
      titleSize: px(d.title),
      subtitleColor: secondary,
      subtitleSize: px(d.subtitle),
      subtitleStyle: "italic",
      labelBg: bg,
      labelColor: secondary,
      labelWeight: "600",
      labelSize: px(d.label),
      labelTransform: "uppercase",
      labelTracking: "0.09em",
      labelBorderBottom: border(1.5, ink),
      labelPad: px(Math.max(d.pad - 2, 2)),
      groupBg: bg,
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group),
      groupTransform: "uppercase",
      groupBorderTop: border(1, ink),
      groupPad: px(Math.max(d.pad - 3, 2)),
      bodySize: px(d.body),
      pad: px(d.pad),
      bodyBorderBottom: border(1, ink),
      tableBorderTop: border(2, accent),
      sourceColor: secondary,
      sourceSize: px(d.source),
    },
    fonts: [
      { family: "Source Serif 4", weights: [400, 600] },
      { family: "Newsreader", weights: [400, 600], italic: true },
      { family: "Public Sans", weights: [600, 700] },
    ],
    rules: (s) =>
      [
        `${s} th.sdvt-group{letter-spacing:0.08em}`,
        `${s} tr.sdvt-group-row + tr td.sdvt-cell{padding-top:${px(Math.max(d.pad - 2, 2))}}`,
        `${s} .sdvt-subtitle{display:block;font-family:var(--sdvt-font-title);padding-bottom:${px(d.pad + 8)}}${s} .sdvt-title{display:block;padding-bottom:${px(Math.ceil(d.pad / 2))}}`,
        `${s} tfoot td{font-family:${sans};padding-top:${px(d.pad + 4)}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
