import { TableSpecError } from "../errors.js";
// src/html/icons.ts — the inline-SVG icon set iconSet / iconAssign draw: plain geometry on a 16x16 grid, drawn for
// sdvtables (no icon font, no Font Awesome), so a table is one self-contained HTML string.
import type { IconName } from "../spec.js";
import { escapeAttr } from "./escape.js";

const PATHS = {
  circle: "M8 1a7 7 0 1 0 0 14A7 7 0 1 0 8 1z",
  square: "M2 2h12v12H2z",
  diamond: "M8 0.5 15.5 8 8 15.5 0.5 8z",
  star: "M8 0.8l2.2 4.6 5 .6-3.7 3.5.9 5L8 12l-4.4 2.5.9-5L.8 6l5-.6z",
  "triangle-up": "M8 1.5 15 14.5H1z",
  "triangle-down": "M1 1.5h14L8 14.5z",
  "arrow-up": "M8 1 14 8H10v7H6V8H2z",
  "arrow-down": "M6 1h4v7h4l-6 7-6-7h4z",
  "arrow-right": "M1 6h7V2l7 6-7 6v-4H1z",
  check: "M1.5 8.5 3.6 6.4 6.2 9 12.4 2.8 14.5 4.9 6.2 13.2z",
  xmark: "M3.1 1 8 5.9 12.9 1 15 3.1 10.1 8 15 12.9 12.9 15 8 10.1 3.1 15 1 12.9 5.9 8 1 3.1z",
  minus: "M1 6.5h14v3H1z",
  plus: "M6.5 1h3v5.5H15v3H9.5V15h-3V9.5H1v-3h5.5z",
  heart: "M8 14.5 1.6 8.2A3.9 3.9 0 0 1 8 3.4a3.9 3.9 0 0 1 6.4 4.8z",
} as const satisfies Readonly<Record<IconName, string>>;

/** Every icon name iconSet / iconAssign accept. */
export const ICON_NAMES: readonly IconName[] = Object.keys(PATHS) as IconName[];

/** One icon as inline SVG, `size` px square, filled with `color` (a CSS colour, already validated by the caller). */
export function iconSvg(name: IconName, color: string, size: number): string {
  const d = Object.hasOwn(PATHS, name) ? PATHS[name] : undefined;
  if (d === undefined)
    throw new TableSpecError(`unknown icon ${JSON.stringify(name)}; icons are ${ICON_NAMES.join(", ")}`);
  return `<svg class="sdvt-icon" viewBox="0 0 16 16" width="${size}" height="${size}" fill="${escapeAttr(color)}" aria-hidden="true" style="vertical-align:middle"><path d="${d}"/></svg>`;
}
