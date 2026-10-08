// src/themes/ncaa.ts — gt_theme_ncaa (_themes.py:1605-1700): Open Sans, a black uppercase label bar, charcoal group bars, striped rows, left-aligned.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density).
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
export const ncaa = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const bg = "#FFFFFF";
  const almarai = fontStack("Almarai");
  return {
    name: "ncaa",
    tokens: {
      ...baseTokens(d, fontStack("Open Sans")),
      bg,
      stripe: "#F4F4F4", // opt_row_striping() default in great_tables
      hline: border(1, "transparent"),
      titleSize: sz(18, "title"),
      subtitleWeight: "400",
      subtitleSize: sz(14, "subtitle"),
      labelBg: "#000000",
      labelColor: "white",
      labelWeight: "400", // great_tables' column-label default; Python sets none
      labelSize: sz(14, "label"),
      labelTransform: "uppercase",
      labelBorderTop: border(1, "black"),
      labelPad: sz(5, "pad"),
      groupBg: "#3C3A40",
      groupColor: "#ffffff",
      groupWeight: "650",
      groupSize: sz(14, "group"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(14, "body"),
      pad: sz(2, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "white"),
      sourceSize: sz(12, "source"),
    },
    fonts: [
      { family: "Open Sans", weights: [400, 650, 700] },
      { family: "Almarai", weights: [400] },
    ],
    rules: (s) =>
      [
        `${s} th.sdvt-label,${s} td.sdvt-cell{padding:5px 5px 5px 25px;text-align:left}`,
        `${s} tfoot td{font-family:${almarai}}`,
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
