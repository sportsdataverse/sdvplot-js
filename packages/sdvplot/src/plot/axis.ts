import * as Plot from "@observablehq/plot";
import { checkHeight, placeSync } from "../placement.js";
import { stampImage } from "../stamp.js";
import type { IdSystem, League, MarkType, SeasonInput, Variant } from "../types.js";

export type Axis = "x" | "y" | "fx" | "fy";
/**
 * Plot's axis options sdvplot does not own pass through: `ticks`, `tickSpacing`, `tickPadding`, `tickRotate`,
 * `fontSize`, `fill`, `ariaLabel`, `ariaDescription`, `facetAnchor`, `className`, the margins, and the rest.
 * sdvplot owns `tickFormat` and `render` (the tick text becomes the image); `anchor`, `tickSize` and `label` are
 * sdvplot's own options below.
 */
export type AxisPassThrough = Omit<
  Plot.AxisXOptions,
  "tickFormat" | "render" | "anchor" | "tickSize" | "label"
>;
/**
 * Options for `axisLogos`. Each drawn image is named by the tick it replaces ("KC logo", "KC wordmark"), so assistive
 * technology reads the category the text showed. The images are sized by `height` (a fraction of the frame); a caller
 * margin on the anchored side smaller than the computed one can clip them.
 */
export interface AxisLogosOptions extends AxisPassThrough {
  league: League;
  season?: SeasonInput;
  /** Fraction of the frame height in (0, 1]; default 0.1. */
  height?: number;
  variant?: Variant;
  markType?: MarkType;
  idSystem?: IdSystem;
  anchor?: "top" | "bottom" | "left" | "right";
  tickSize?: number;
  label?: string | null;
}
// Plot 0.6.17's default anchor per axis (axis.js: anchorX/Y/Fx/Fy).
const DEFAULT_ANCHOR = { x: "bottom", y: "left", fx: "top", fy: "right" } as const;
const AXIS: Record<Axis, (options: Plot.AxisXOptions) => Plot.Markish> = {
  x: Plot.axisX,
  y: Plot.axisY,
  fx: Plot.axisFx,
  fy: Plot.axisFy,
} as const;

/** Axis mark whose tick text is swapped for the team image; categories that do not resolve keep their text. */
export function axisLogos(axis: Axis, o: AxisLogosOptions): Plot.Markish {
  const {
    league: _l,
    season: _s,
    height: _h,
    variant: _v,
    markType: _m,
    idSystem: _i,
    anchor: _a,
    tickSize: _t,
    label: _b,
    ...pass
  } = o;
  const height = checkHeight(o.height ?? 0.1);
  const kind = o.markType ?? "logo";
  const tickSize = o.tickSize ?? 6;
  const horizontal = axis === "x" || axis === "fx";
  const side = o.anchor ?? DEFAULT_ANCHOR[axis];
  const render: Plot.RenderFunction = (index, scales, values, dimensions, context, next) => {
    const g = next?.(index, scales, values, dimensions, context) as SVGElement | null | undefined;
    const text = values.text as ArrayLike<string> | undefined;
    if (!g || !text) return g ?? null; // the tick-vector sub-mark has no text channel: leave it alone
    const labels = Array.from(index, (i) => text[i] ?? ""); // `index` may be a typed array, whose map() coerces to numbers
    const placed = placeSync(
      labels.map(() => 0),
      labels.map(() => 0),
      labels,
      {
        league: o.league,
        kind,
        variant: o.variant ?? "default",
        ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
        ...(o.season === undefined ? {} : { season: o.season }),
      },
    );
    const byIndex = new Map(placed.map((p) => [p.index, p]));
    const frame = dimensions.height - dimensions.marginTop - dimensions.marginBottom;
    const px = height * frame;
    const X = values.x as ArrayLike<number> | undefined;
    const Y = values.y as ArrayLike<number> | undefined;
    const texts = g.querySelectorAll("text");
    index.forEach((i, k) => {
      const t = texts[k];
      const p = byIndex.get(k);
      if (!t || !p) return; // the unknown category keeps its <text>
      // fx/fy tick marks carry no x/y channel: take the band centre from the facet scale instead
      const pos = horizontal ? X?.[i] : Y?.[i];
      const sc = (scales as unknown as Record<string, unknown>)[axis] as
        | (((v: unknown) => number | undefined) & { bandwidth?: () => number })
        | undefined;
      const tick = pos ?? (sc ? (sc(labels[k]) ?? Number.NaN) + (sc.bandwidth?.() ?? 0) / 2 : undefined);
      if (tick === undefined || Number.isNaN(tick)) return;
      const w = px * (p.aspect ?? 1);
      const gap = 3; // Plot already translated this <g> by tickSize + tickPadding
      const c =
        side === "bottom"
          ? [tick, dimensions.height - dimensions.marginBottom + gap + px / 2]
          : side === "top"
            ? [tick, dimensions.marginTop - gap - px / 2]
            : side === "left"
              ? [dimensions.marginLeft - gap - w / 2, tick]
              : [dimensions.width - dimensions.marginRight + gap + w / 2, tick];
      const [cx, cy] = c as [number, number];
      const img = context.document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", p.url);
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      img.setAttribute("data-sdv-axis", axis);
      img.setAttribute("data-sdv-tick", String(tick));
      img.setAttribute("aria-label", `${labels[k]} ${kind}`); // the tick text it replaces, as the Vega adapter (PR #28)
      stampImage(img, p, kind, px, frame, cx, cy);
      t.replaceWith(img);
    });
    return g;
  };
  // ponytail: margin is sized for the default 400px plot; pass height/margins explicitly for other plot heights
  const margin = Math.round(height * 400) + tickSize + 8;
  const marginKey = `margin${side[0]?.toUpperCase()}${side.slice(1)}` as keyof AxisPassThrough;
  return AXIS[axis]({
    ...pass,
    tickFormat: (d: unknown) => String(d),
    tickSize,
    label: o.label ?? null,
    ...(o.anchor ? { anchor: o.anchor } : {}),
    [marginKey]: pass[marginKey] ?? pass.margin ?? margin, // a caller's own margin on the anchored side wins
    render,
  } as Plot.AxisXOptions);
}
