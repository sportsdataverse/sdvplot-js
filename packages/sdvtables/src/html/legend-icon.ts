// src/html/legend-icon.ts — the legendIcon decoration (reactablefmtr add_icon_legend, R/add_icon_legend.R in 2.1.0):
// presets and layout from reactablefmtr; icons are small inline SVGs, so no icon font is loaded.
import { TableSpecError } from "../errors.js";
import type { LegendIconDecoration, LegendIconShape } from "../spec.js";
import { checkPx, cssValue, escapeAttr, escapeHtml } from "./escape.js";

/** reactablefmtr's three icon sets: shape, colour and default label of each icon. */
export const LEGEND_ICON_SETS: Readonly<
  Record<
    NonNullable<LegendIconDecoration["iconSet"]>,
    readonly (readonly [LegendIconShape, string, string])[]
  >
> = {
  "ski rating": [
    ["circle", "#39b54a", "Easy"],
    ["square", "#0f75bc", "Moderate"],
    ["diamond", "#000000", "Difficult"], // Font Awesome "square" turned 45 degrees
    ["double-diamond", "#000000", "Most Difficult"],
  ],
  medals: [
    ["medal", "#A77044", "Bronze"],
    ["medal", "#D7D7D7", "Silver"],
    ["medal", "#D6AF36", "Gold"],
  ],
  batteries: [
    ["battery-quarter", "#d7191c", "0-25%"],
    ["battery-half", "#fdae61", "25-50%"],
    ["battery-three-quarters", "#a6d96a", "50-75%"],
    ["battery-full", "#1a9641", "75-100%"],
  ],
};

const battery = (level: number): string =>
  `<rect x="0.75" y="4.25" width="12.5" height="7.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13.75" y="6.5" width="1.75" height="3" fill="currentColor"/><rect x="2.5" y="6" width="${9 * level}" height="4" fill="currentColor"/>`;
/** Each shape's SVG body on a 16-unit square (double-diamond is 30 wide), drawn in currentColor. */
const SHAPES: Readonly<Record<LegendIconShape, readonly [number, string]>> = {
  circle: [16, `<circle cx="8" cy="8" r="7" fill="currentColor"/>`],
  square: [16, `<rect x="1" y="1" width="14" height="14" fill="currentColor"/>`],
  diamond: [16, `<path d="M8 .5 15.5 8 8 15.5 .5 8Z" fill="currentColor"/>`],
  "double-diamond": [
    30,
    `<path d="M8 .5 15.5 8 8 15.5 .5 8ZM22 .5 29.5 8 22 15.5 14.5 8Z" fill="currentColor"/>`,
  ],
  "triangle-up": [16, `<path d="M8 1.5 15 14.5H1Z" fill="currentColor"/>`],
  "triangle-down": [16, `<path d="M1 1.5H15L8 14.5Z" fill="currentColor"/>`],
  medal: [
    16,
    `<path d="M3 0h3.5l2 5.5H5ZM13 0H9.5l-2 5.5H11Z" fill="currentColor"/><circle cx="8" cy="10.5" r="5" fill="currentColor"/>`,
  ],
  "battery-quarter": [16, battery(0.25)],
  "battery-half": [16, battery(0.5)],
  "battery-three-quarters": [16, battery(0.75)],
  "battery-full": [16, battery(1)],
};

/** One icon as an inline SVG `size` px high, coloured through `color` (validated CSS). */
export function legendIconSvg(shape: LegendIconShape, color: string, size: number): string {
  const s = SHAPES[shape];
  if (!s)
    throw new TableSpecError(
      `legendIcon icon must be one of ${Object.keys(SHAPES).join(", ")}, not "${shape}"`,
    );
  const [w, body] = s;
  return `<svg class="sdvt-legend-icon" viewBox="0 0 ${w} 16" width="${(size * w) / 16}" height="${size}" aria-hidden="true" focusable="false" style="color:${escapeAttr(cssValue(color, "legendIcon colors"))};vertical-align:middle">${body}</svg>`;
}

/** The legend block: an optional bold title, the icons with their labels, an optional muted footer. */
export function legendIconBlock(d: LegendIconDecoration): string {
  if (d.align !== "left" && d.align !== "right")
    throw new TableSpecError(`legendIcon align must be left or right, not "${String(d.align)}"`);
  if (d.location !== "top" && d.location !== "bottom")
    throw new TableSpecError(`legendIcon location must be top or bottom, not "${String(d.location)}"`);
  const size = checkPx(d.iconSize, "legendIcon iconSize");
  if (size <= 0) throw new TableSpecError(`legendIcon iconSize must be positive, got ${size}`);
  let items: (readonly [LegendIconShape, string, string])[];
  if (d.iconSet !== undefined) {
    const set = LEGEND_ICON_SETS[d.iconSet];
    if (!set)
      throw new TableSpecError(
        `legendIcon iconSet must be "ski rating", "medals" or "batteries", not "${d.iconSet}"`,
      );
    if (d.labels && d.labels.length !== set.length)
      throw new TableSpecError(
        `legendIcon iconSet "${d.iconSet}" needs ${set.length} labels, got ${d.labels.length}`,
      );
    items = set.map(([shape, color, label], i) => [shape, color, d.labels?.[i] ?? label]);
  } else {
    if (!d.icons || d.icons.length === 0) throw new TableSpecError("legendIcon needs an iconSet or icons");
    const colors = d.colors && d.colors.length > 0 ? d.colors : ["currentColor"];
    if (d.labels && d.labels.length !== d.icons.length)
      throw new TableSpecError(
        `legendIcon needs one label per icon: ${d.icons.length} icons, ${d.labels.length} labels`,
      );
    // without visible labels the label is still the icon's accessible name, so every icon needs one
    if (!d.labels) throw new TableSpecError("legendIcon icons need labels");
    items = d.icons.map((shape, i) => [shape, colors[i % colors.length] as string, d.labels?.[i] as string]);
  }
  const icons = items
    .map(([shape, color, label]) =>
      d.showLabels
        ? `<span class="sdvt-legend-item" style="display:inline-flex;align-items:center;gap:4px">${legendIconSvg(shape, color, size)}${escapeHtml(label)}</span>`
        : `<span class="sdvt-legend-item" role="img" aria-label="${escapeAttr(label)}">${legendIconSvg(shape, color, size)}</span>`,
    )
    .join("");
  const justify = d.align === "left" ? "flex-start" : "flex-end";
  return `<div class="sdvt-legend sdvt-legend-icon sdvt-legend-${d.location}" style="text-align:${d.align}">${d.title ? `<div class="sdvt-legend-title" style="margin-bottom:8px;font-weight:bold;font-size:90%">${escapeHtml(d.title)}</div>` : ""}<div style="display:flex;flex-wrap:wrap;justify-content:${justify};align-items:center;gap:4px 10px;font-size:13px;word-spacing:1px">${icons}</div>${d.footer ? `<div class="sdvt-legend-sub" style="font-size:70%;color:var(--sdvt-muted)">${escapeHtml(d.footer)}</div>` : ""}</div>`;
}
