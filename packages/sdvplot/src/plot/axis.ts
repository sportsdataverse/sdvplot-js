import * as Plot from "@observablehq/plot";
import { checkHeight, placeSync } from "../placement.js";
import type { IdSystem, League, MarkType, SeasonInput, Variant } from "../types.js";
import { stampImage } from "./marks.js";

export type Axis = "x" | "y" | "fx" | "fy";
export interface AxisLogosOptions {
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
const AXIS: Record<Axis, (options: Plot.AxisXOptions) => Plot.Markish> = {
  x: Plot.axisX,
  y: Plot.axisY,
  fx: Plot.axisFx,
  fy: Plot.axisFy,
} as const;

/** Axis mark whose tick text is swapped for the team image; categories that do not resolve keep their text. */
export function axisLogos(axis: Axis, o: AxisLogosOptions): Plot.Markish {
  const height = checkHeight(o.height ?? 0.1);
  const kind = o.markType ?? "logo";
  const tickSize = o.tickSize ?? 6;
  const horizontal = axis === "x" || axis === "fx";
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
      const tick = (horizontal ? X?.[i] : Y?.[i]) as number;
      const w = px * (p.aspect ?? 1);
      const cx = horizontal ? tick : dimensions.marginLeft - tickSize - 3 - w / 2;
      const cy = horizontal ? dimensions.height - dimensions.marginBottom + tickSize + 3 + px / 2 : tick;
      const img = context.document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", p.url);
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      img.setAttribute("data-sdv-axis", axis);
      img.setAttribute("data-sdv-tick", String(tick));
      stampImage(img, p, kind, px, frame, cx, cy);
      t.replaceWith(img);
    });
    return g;
  };
  // ponytail: margin is sized for the default 400px plot; pass height/margins explicitly for other plot heights
  const margin = Math.round(height * 400) + tickSize + 8;
  return AXIS[axis]({
    tickFormat: (d: unknown) => String(d),
    tickSize,
    label: o.label ?? null,
    ...(o.anchor ? { anchor: o.anchor } : {}),
    ...(horizontal ? { marginBottom: margin } : { marginLeft: margin }),
    render,
  } as Plot.AxisXOptions);
}
