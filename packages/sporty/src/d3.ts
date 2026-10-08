import type { BaseType, Selection } from "d3";
import { type Scene, hidden, isVisiblePolygon, isVisibleText } from "./scene.js";

/** A selection of `G` with any datum and parent: d3's `Selection` is invariant in its datum, so `unknown` would reject `create("svg")`. */
type Sel<G extends Element, D> = Selection<G, D, BaseType, unknown>;

/**
 * Append a Scene to a d3 selection as `<g class="sporty-surface">`, drawn through the caller's x/y
 * scale functions: optional background rect, then polygons and text in zIndex order. Applies the
 * same skips as `toSVG` (see `isVisiblePolygon` / `isVisibleText`). Text font size is the number
 * height (`fitBox[1] / 1.5`) mapped through `y`. `ariaDescription` (default: the scene's league and sport, then
 * "surface", such as "nba basketball surface", as `surfaceMark`) describes the group for assistive technology.
 */
export function appendSurface<G extends SVGGElement | SVGSVGElement, D>(
  selection: Sel<G, D>,
  scene: Scene,
  x: (v: number) => number,
  y: (v: number) => number,
  o: { ariaDescription?: string } = {},
): Sel<SVGGElement, D> {
  const g = selection
    .append("g")
    .attr("class", "sporty-surface")
    .attr("aria-description", o.ariaDescription ?? `${scene.league} ${scene.sport} surface`);
  const [x0, y0, x1, y1] = scene.bbox;
  if (scene.background !== undefined)
    g.append("rect")
      .attr("x", Math.min(x(x0), x(x1)))
      .attr("y", Math.min(y(y0), y(y1)))
      .attr("width", Math.abs(x(x1) - x(x0)))
      .attr("height", Math.abs(y(y1) - y(y0)))
      .attr("fill", scene.background)
      .attr("data-feature", "background");
  const ordered = scene.features.slice().sort((a, b) => a.zIndex - b.zIndex); // stable
  for (const f of ordered) {
    if (f.kind === "polygon") {
      if (!isVisiblePolygon(f)) continue;
      const d = `${f.points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${x(px)},${y(py)}`).join("")}Z`;
      const p = g
        .append("path")
        .attr("d", d)
        .attr("fill", hidden(f.fill) ? "none" : f.fill)
        .attr("data-feature", f.name);
      if (f.stroke !== undefined) p.attr("stroke", f.stroke);
    } else {
      if (!isVisibleText(f)) continue;
      const cx = x(f.x);
      const cy = y(f.y);
      g.append("text")
        .attr("x", cx)
        .attr("y", cy)
        .attr("fill", f.fill)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-family", f.fontFamily)
        .attr("font-size", Math.abs(y(f.fitBox[1] / 1.5) - y(0)))
        .attr("transform", `rotate(${-f.rotation} ${cx} ${cy})`)
        .attr("data-feature", f.name)
        .text(f.text);
    }
  }
  return g;
}
