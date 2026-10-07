// src/themes/scoreboard.ts — gt_theme_scoreboard (_themes.py:1108-1209): condensed caps on a solid accent label bar
import { onColor } from "@sportsdataverse/sdvplot";
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const scoreboard = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#0E1621", "accent");
  const ink = "#141719";
  const rule = "#E6E9ED";
  const muted = "#5A6069";
  const bg = "#FFFFFF";
  const condensed = fontStack("Barlow Condensed");
  return {
    name: "scoreboard",
    tokens: {
      ...baseTokens(d, fontStack("Barlow")),
      fontLabel: condensed,
      fontTitle: condensed,
      bg,
      text: ink,
      muted,
      accent,
      rule,
      hline: border(1, rule),
      headingBg: bg,
      titleColor: ink,
      titleSize: px(d.title + 4),
      titleTransform: "uppercase",
      titleTracking: "0.01em",
      subtitleColor: muted,
      subtitleWeight: "500",
      subtitleSize: px(d.subtitle + 1),
      labelBg: accent,
      labelColor: onColor(accent), // a pale accent needs dark labels, so measure it
      labelWeight: "700",
      labelSize: px(d.label + 2),
      labelTransform: "uppercase",
      labelTracking: "0.06em",
      labelPad: px(d.pad + 2),
      groupBg: "#F2F4F6",
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group + 1),
      groupTransform: "uppercase",
      groupPad: px(Math.max(d.pad, 3)),
      bodySize: px(d.body),
      bodyWeight: "500",
      pad: px(d.pad),
      headingPad: px(d.pad + 1),
      sourcePad: px(d.pad + 2),
      bodyBorderBottom: border(2, accent),
      sourceColor: muted,
      sourceSize: px(d.source),
    },
    fonts: [
      { family: "Barlow", weights: [500] },
      { family: "Barlow Condensed", weights: [500, 700] },
    ],
    rules: (s) =>
      [
        `${s} caption{letter-spacing:0.01em}`,
        `${s} th.sdvt-group{letter-spacing:0.06em}`,
        `${s} .sdvt-subtitle{display:block;font-family:var(--sdvt-font-title);padding-bottom:${px(d.pad + 6)}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
