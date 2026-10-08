/**
 * Chart.js 4 court / field / rink background: `surface(league, o)` paints a team-painted sporty scene under the
 * datasets. Split from `sdvplot/chartjs` because it draws through `@sportsdataverse/sporty/canvas` (optional peer), which
 * the logo and colour plugins do not need. `chart.js` is a type-only import (optional peer, 4.4 or later).
 */
import type { Scene } from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { Chart, Plugin } from "chart.js";
import { InputError, warn } from "./errors.js";
import { type SurfaceSceneOptions, surfaceScene } from "./surfaces.js";
import type { League } from "./types.js";

export interface ChartSurfaceOptions extends SurfaceSceneOptions {
  /** The linear x scale's id (default `"x"`). */
  xAxisID?: string;
  /** The linear y scale's id (default `"y"`). */
  yAxisID?: string;
}
export interface LinearScale {
  type: "linear";
  min: number;
  max: number;
}
export interface ChartSurface {
  /** Paints the surface before the datasets (`beforeDatasetsDraw`), clipped to the chart area. */
  plugin: Plugin;
  /** Linear scales spanning the surface, for `options.scales` (keep both axes linear). */
  scales: { x: LinearScale; y: LinearScale };
  scene: Scene;
}
/**
 * A team-painted sporty surface as a Chart.js background: a shot chart is a scatter (a hexbin, a bubble chart) over a
 * court. Throws `InputError` for a league without a surface, or for a scene whose bbox is empty (an `xlim` or `ylim` of
 * zero width) here, when it is built, not inside a Chart.js draw. A non-linear axis is left unpainted, with one warning.
 */
export function surface(league: League, o: ChartSurfaceOptions = {}): ChartSurface {
  const { xAxisID = "x", yAxisID = "y", ...rest } = o;
  const scene = surfaceScene(league, rest);
  const [x0, y0, x1, y1] = scene.bbox;
  // drawScene would throw sporty's InputError on the first draw, inside Chart.js's render loop
  if (!(x1 > x0 && y1 > y0 && Number.isFinite(x1 - x0 + y1 - y0)))
    throw new InputError(
      `surface("${league}"): the scene's bbox [${scene.bbox.join(", ")}] is empty, so there is nothing to draw (check xlim / ylim)`,
    );
  return {
    plugin: {
      id: "sdvplotSurface",
      beforeDatasetsDraw: (chart) => paintScene(chart, scene, xAxisID, yAxisID),
    },
    scales: { x: { type: "linear", min: x0, max: x1 }, y: { type: "linear", min: y0, max: y1 } },
    scene,
  };
}
function paintScene(chart: Chart, scene: Scene, xId: string, yId: string): void {
  const { ctx, chartArea: a } = chart;
  const xs = chart.scales[xId];
  const ys = chart.scales[yId];
  if (!a || xs === undefined || ys === undefined) return; // a draw before the first layout
  if (xs.type !== "linear" || ys.type !== "linear") {
    warn(
      `chartjs:surface:${xId}:${yId}`,
      `surface needs linear scales (pass court.scales); ${xId} is ${xs.type} and ${yId} is ${ys.type}, so it is not drawn`,
    );
    return;
  }
  const ox = xs.getPixelForValue(0);
  const oy = ys.getPixelForValue(0);
  const kx = xs.getPixelForValue(1) - ox; // px per scene unit; negative on a reversed axis
  const ky = ys.getPixelForValue(1) - oy; // negative: y points up
  const s = Math.abs(kx);
  if (!(s > 0 && Number.isFinite(s + ky))) return; // a zero-size chart area
  const [x0, , , y1] = scene.bbox;
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top);
  ctx.clip();
  // drawScene paints (x, y) at (s(x - x0), s(y1 - y)) and composes with the current transform (the chart's own
  // device-pixel-ratio transform stays under both): this map turns that into the chart's scales, axis by axis.
  ctx.transform(kx / s, 0, 0, -ky / s, ox + kx * x0, oy + ky * y1);
  drawScene(ctx, scene, { scale: s }); // strokes are 1/s scene units: one px wide
  ctx.restore();
}
