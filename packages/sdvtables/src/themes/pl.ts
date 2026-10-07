// src/themes/pl.ts — gt_theme_pl (_themes.py:1703-1791): DM Sans in purple on white, a purple rule under every row but the last.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density). Nothing sets the title or subtitle size, so great_tables'
// 125% / 85% of its 16px table font apply (percentages follow the table font, hence the body role); title, subtitle and notes keep its #333333.
import type { ThemeRef } from "../spec.js";
import {
  type Role,
  type Theme,
  baseTokens,
  border,
  densitySizes,
  fontStack,
  px,
  scaleFor,
} from "./tokens.js";
export const pl = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const bg = "#FFFFFF";
  const purple = "#37003c";
  const dim = "#87668a";
  return {
    name: "pl",
    tokens: {
      ...baseTokens(d, fontStack("DM Sans")),
      bg,
      text: purple,
      muted: dim,
      rule: purple,
      hline: border(1, purple),
      titleColor: "#333333",
      titleWeight: "650",
      titleSize: sz(20, "body"),
      subtitleColor: "#333333",
      subtitleWeight: "500",
      subtitleSize: sz(13.6, "body"),
      labelBg: bg,
      labelColor: dim,
      labelWeight: "650",
      labelSize: sz(13, "label"),
      labelBorderBottom: border(1, purple),
      labelPad: sz(5, "pad"),
      groupBg: "#C0BACA",
      groupColor: "#ffffff",
      groupWeight: "650",
      groupSize: sz(12, "group"),
      groupBorderBottom: border(1, purple),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(14, "body"),
      pad: sz(2, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "white"),
      sourceColor: "#333333",
      sourceSize: sz(12, "source"),
    },
    fonts: [{ family: "DM Sans", weights: [500, 650] }],
    rules: (s) =>
      [
        `${s} tbody{border-top:1px solid ${purple}}`,
        `${s} th.sdvt-label{padding-bottom:3px}`,
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:2px 0 6px}`,
        `${s} tfoot td{line-height:1.2}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
