// src/themes/savant.ts — gt_theme_savant (_themes.py:1794-1877): Roboto Condensed, black group bars, striped rows, a centered heading.
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
export const savant = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const bg = "#FFFFFF";
  return {
    name: "savant",
    tokens: {
      ...baseTokens(d, fontStack("Roboto Condensed")),
      bg,
      stripe: "#F4F4F4", // opt_row_striping() default in great_tables
      hline: border(1, "transparent"),
      headingAlign: "center",
      titleSize: sz(18, "title"),
      subtitleWeight: "400",
      subtitleSize: sz(14, "subtitle"),
      labelBg: bg,
      labelWeight: "700",
      labelSize: sz(14, "label"),
      labelBorderTop: border(1, "black"),
      labelPad: "2px",
      groupBg: "#000000",
      groupColor: "#FFFDF5",
      groupWeight: "650",
      groupSize: sz(14, "group"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(14, "body"),
      pad: sz(1, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "white"),
      sourceSize: sz(12, "source"),
    },
    fonts: [{ family: "Roboto Condensed", weights: [400, 650, 700] }],
    rules: (s) =>
      [
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
