import { type Color, type Feature, type Scene, hidden, isVisiblePolygon, isVisibleText } from "./scene.js";
import { fmt, pathData } from "./svg-arcs.js";

export interface SvgOptions {
  width?: number;
  height?: number;
  background?: Color;
  precision?: number;
  id?: string;
  /** `"sampled"` (default) emits every point as `L`; `"svg"` replaces detected circle runs with `A` commands. */
  arcs?: "sampled" | "svg";
  /**
   * Describes the surface for assistive technology, on the `<g>` that holds it; default the scene's league and sport,
   * then "surface", such as "nba basketball surface" (as `surfaceMark`).
   */
  ariaDescription?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Render a Scene to an SVG string (no DOM; Node and browser). Y is flipped via a `<g>` transform.
 *
 * @example
 * ```ts
 * import { surface } from "@sportsdataverse/sporty";
 * import { toSVG } from "@sportsdataverse/sporty/svg";
 *
 * // arcs: "svg" writes circles as arc commands and precision trims the digits: a smaller file, the same court
 * toSVG(surface("basketball", "nba"), { width: 480, background: "#f5f0e1", arcs: "svg", precision: 2 });
 * ```
 */
export function toSVG(scene: Scene, o: SvgOptions = {}): string {
  const [x0, y0, x1, y1] = scene.bbox;
  const p = o.precision ?? 4;
  const n = (v: number): string => fmt(v, p);
  const w = o.width ?? 800;
  const h = o.height ?? Math.round((w * (y1 - y0)) / (x1 - x0));
  const bg = o.background ?? scene.background;
  const body: string[] = [];
  if (bg !== undefined)
    body.push(
      `<rect x="${n(x0)}" y="${n(y0)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}" fill="${esc(bg)}"/>`,
    );
  const sorted: Feature[] = [...scene.features].sort((a, b) => a.zIndex - b.zIndex); // stable
  for (const f of sorted) {
    if (f.kind === "polygon") {
      if (!isVisiblePolygon(f)) continue;
      const noFill = hidden(f.fill);
      const d = pathData(f.points, o.arcs ?? "sampled", p);
      const stroke =
        f.stroke === undefined ? "" : ` stroke="${esc(f.stroke)}" vector-effect="non-scaling-stroke"`;
      body.push(`<path d="${d}" fill="${noFill ? "none" : esc(f.fill)}"${stroke}/>`);
    } else {
      if (!isVisibleText(f)) continue;
      // ponytail: font-size = fit-box height, no width fitting; refine in Phase 6
      body.push(
        `<text x="${n(f.x)}" y="${n(-f.y)}" font-family="${esc(f.fontFamily)}" font-size="${n(f.fitBox[1])}" fill="${esc(f.fill)}" text-anchor="middle" dominant-baseline="central" transform="scale(1,-1) rotate(${n(-f.rotation)} ${n(f.x)} ${n(-f.y)})">${esc(f.text)}</text>`,
      );
    }
  }
  const id = o.id === undefined ? "" : ` id="${esc(o.id)}"`;
  const description = esc(o.ariaDescription ?? `${scene.league} ${scene.sport} surface`);
  return `<svg xmlns="http://www.w3.org/2000/svg"${id} viewBox="${n(x0)} ${n(-y1)} ${n(x1 - x0)} ${n(y1 - y0)}" width="${w}" height="${h}"><g transform="scale(1,-1)" aria-description="${description}">${body.join("")}</g></svg>`;
}
