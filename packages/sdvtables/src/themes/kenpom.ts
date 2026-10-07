// src/themes/kenpom.ts — gt_theme_kenpom (_themes.py:1509-1602): Helvetica, pale-blue label and group bands, alternating row tint.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density). Helvetica Neue is a system face: no Google font.
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
export const kenpom = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const bg = "#FFFFFF";
  const band = "#c3d9ff";
  const bandInk = "#02b";
  return {
    name: "kenpom",
    tokens: {
      ...baseTokens(d, fontStack("Helvetica Neue")),
      bg,
      hline: border(1, "#000000"),
      headingAlign: "center",
      titleWeight: "650",
      titleSize: sz(18, "title"),
      subtitleWeight: "500",
      subtitleSize: sz(14, "subtitle"),
      labelBg: band,
      labelColor: bandInk,
      labelWeight: "650",
      labelSize: sz(14, "label"),
      labelPad: "2px",
      groupBg: band,
      groupColor: bandInk,
      groupWeight: "bold",
      groupSize: sz(14, "group"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(16, "body"),
      bodyWeight: "500",
      pad: sz(2, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "white"),
      sourceSize: sz(12, "source"),
    },
    fonts: [],
    rules: (s) =>
      [
        // R's odd and even rows (1-based), counted over data rows only (group rows excluded)
        `${s} tbody tr.sdvt-row:nth-child(odd of :not(.sdvt-group-row)) td.sdvt-cell{background-color:#F2FAFD}`,
        `${s} tbody tr.sdvt-row:nth-child(even of :not(.sdvt-group-row)) td.sdvt-cell{background-color:#e5ecf9}`,
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-title,${s} .sdvt-subtitle{display:block;text-align:left}`, // the title and subtitle styles align left inside a centered heading
        `${s} .sdvt-subtitle{padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
