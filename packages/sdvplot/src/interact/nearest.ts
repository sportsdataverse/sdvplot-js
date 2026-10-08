import { Delaunay, bisector, pointer } from "d3";
import { InputError } from "../errors.js";
import type { SelectionStore } from "../selection.js";
import { hasDom } from "./highlight.js";
import { svgBox, svgRoot, tooltip } from "./tooltip.js";

/** A hover target: a mark's centre in PIXELS, in the svg's user space (where its scales put it), and its link id. */
export interface HoverPoint {
  /** Horizontal position, svg user units. */
  readonly x: number;
  /** Vertical position, svg user units. */
  readonly y: number;
  /** The link id the mark is stamped with (`data-sdv-id`). */
  readonly id: string;
}
/** Options for {@link nearestHover}. */
export interface NearestHoverOptions {
  /** Every hoverable mark's centre. Points with a non-finite coordinate are skipped. */
  readonly points: readonly HoverPoint[];
  /** `"xy"` (the default): nearest in the plane. `"x"` / `"y"`: nearest along that axis alone, ignoring the other. */
  readonly dimension?: "x" | "y" | "xy";
  /** Farthest hover, in px: Euclidean for `"xy"`, along the axis for `"x"` / `"y"`. Default: unlimited. */
  readonly radius?: number;
  /** A margin inside the svg's bounds, in px, where the pointer hovers nothing. Default 0. */
  readonly padding?: number;
  /** The tooltip for a hovered id, shown at its point; `null` shows none. Default: no tooltip. */
  readonly label?: (id: string) => { readonly lines: readonly string[]; readonly swatch?: string } | null;
}
/** A live {@link nearestHover}. */
export interface NearestHoverHandle {
  /** Re-target after a zoom or a resize: the marks' new centres. */
  update(points: readonly HoverPoint[]): void;
  /** Remove the listeners and the tooltip; clears `hover` when it still holds what this handle wrote. */
  destroy(): void;
}

const NOOP: NearestHoverHandle = { update: () => {}, destroy: () => {} };
const DIMENSIONS: readonly unknown[] = ["x", "y", "xy"];

/**
 * Hover the NEAREST mark of a d3-drawn (or any non-Plot) figure, within a radius, rather than the element under the
 * pointer: sparse or small marks stay easy to hit. `"xy"` finds it with a Delaunay triangulation (`Delaunay.find`,
 * as blazing-the-nets' hex chart does within 18 px); `"x"` / `"y"` bisect the points sorted along that axis (a 1-D
 * Voronoi, as its distance bars do). The pointer writes `hover: [id]`, once per distinct mark; beyond `radius`, inside
 * the `padding` margin, on `pointerleave` / `pointercancel` or with no points, it writes `hover: []`. `label` shows a
 * {@link tooltip} at the mark, not at the pointer. Link the same figure with `hover: false` in `linkSelection` so
 * this is its only hover writer while `highlight` still follows the store. The pointer listeners capture,
 * so a handler registered earlier on the svg that stops the event (Plot's `tip` on `pointerdown`) cannot hide it.
 * A Plot figure hovers through its own `tip` instead (`linkSelection`'s `hover: { id }`). Throws `InputError` on a
 * negative `radius` or `padding` or an unknown `dimension`, in Node too, and when `root` is not an `<svg>`. Returns a
 * HANDLE, not a teardown function, because it has more to do than tear down: `update` re-targets it and `destroy`
 * removes it (`linkSelection` and `linkCursor`, whose teardown is all they have, return a function). A no-op handle
 * without a DOM.
 *
 * @example
 * ```ts
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { linkSelection, nearestHover } from "@sportsdataverse/sdvplot/interact";
 * import * as d3 from "d3";
 *
 * const rows = [
 *   { team: "KC", wins: 15, net_epa: 0.063 },
 *   { team: "BUF", wins: 13, net_epa: 0.19 },
 *   { team: "MIA", wins: 8, net_epa: -0.019 },
 *   { team: "LV", wins: 4, net_epa: -0.146 },
 * ];
 * const x = d3.scaleLinear([0, 17], [30, 410]);
 * const y = d3.scaleLinear([-0.2, 0.2], [190, 10]);
 * const svg = d3.create("svg").attr("viewBox", "0 0 440 200").attr("width", 440);
 * svg
 *   .selectAll("circle")
 *   .data(rows)
 *   .join("circle")
 *   .attr("data-sdv-id", (d) => d.team) // the d3 way to stamp link ids
 *   .attr("cx", (d) => x(d.wins))
 *   .attr("cy", (d) => y(d.net_epa))
 *   .attr("r", 5)
 *   .attr("fill", "currentColor");
 * const node = svg.node() as SVGSVGElement;
 * const store = createSelection();
 * linkSelection(store, { figure: node, hover: false }); // highlight follows the store; nearestHover writes hover
 * nearestHover(node, store, {
 *   points: rows.map((d) => ({ x: x(d.wins), y: y(d.net_epa), id: d.team })),
 *   radius: 18,
 *   label: (team) => ({ lines: [team, `net EPA/play ${rows.find((d) => d.team === team)?.net_epa}`] }),
 * });
 * node; // hover near a dot: within 18 px it lights and its tooltip shows
 * ```
 */
export function nearestHover<R>(
  root: Element,
  store: SelectionStore<R>,
  o: NearestHoverOptions,
): NearestHoverHandle {
  const { dimension = "xy", radius = Number.POSITIVE_INFINITY, padding = 0, label } = o;
  if (!DIMENSIONS.includes(dimension))
    throw new InputError(`nearestHover: dimension must be "x", "y" or "xy" (got ${String(dimension)})`);
  if (!(radius >= 0)) throw new InputError(`nearestHover: radius must be a number >= 0 (got ${radius})`);
  if (!(padding >= 0)) throw new InputError(`nearestHover: padding must be a number >= 0 (got ${padding})`);
  if (!hasDom()) return NOOP;
  const svg = svgRoot(root, "nearestHover");
  const tip = label ? tooltip(svg) : null;
  const far = (p: HoverPoint, px: number, py: number): number =>
    dimension === "x"
      ? Math.abs(p.x - px)
      : dimension === "y"
        ? Math.abs(p.y - py)
        : Math.hypot(p.x - px, p.y - py);
  let find: (px: number, py: number) => HoverPoint | undefined = () => undefined;
  const index = (points: readonly HoverPoint[]): void => {
    const ps = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (ps.length === 0) find = () => undefined;
    else if (dimension === "xy") {
      const d = Delaunay.from(
        ps,
        (p) => p.x,
        (p) => p.y,
      );
      find = (px, py) => ps[d.find(px, py)];
    } else {
      const k = dimension;
      const sorted = ps.slice().sort((a, b) => a[k] - b[k]);
      const b = bisector<HoverPoint, number>((p) => p[k]);
      find = (px, py) => sorted[b.center(sorted, k === "x" ? px : py)];
    }
  };
  index(o.points);
  let cur: string | null | undefined; // the id last shown; undefined: unknown, so the next event writes and re-places
  let wrote: ReadonlySet<string> | null = null; // the store's hover set this handle wrote; destroy clears it
  const to = (p: HoverPoint | undefined): void => {
    const id = p === undefined ? null : p.id;
    if (id === cur) return;
    cur = id;
    const had = store.getState().hover;
    store.set({ hover: id === null ? [] : [id] });
    const now = store.getState().hover;
    // owned by identity: an equal hover set first elsewhere keeps its identity (a no-op patch), so it stays theirs
    wrote = now !== had || had === wrote ? now : null;
    const shown = p !== undefined && label ? label(p.id) : null;
    if (shown && p) tip?.show(p.x, p.y, shown.lines, shown.swatch);
    else tip?.hide();
  };
  const move = (e: Event): void => {
    const [px, py] = pointer(e, svg);
    const b = svgBox(svg);
    const inside =
      px >= b.x + padding &&
      px <= b.x + b.width - padding &&
      py >= b.y + padding &&
      py <= b.y + b.height - padding;
    const p = inside ? find(px, py) : undefined;
    to(p !== undefined && far(p, px, py) <= radius ? p : undefined);
  };
  const leave = (): void => to(undefined);
  // A34: capture, so a listener registered on the svg before ours (Plot's sticky-tip pointerdown) cannot stop it
  const listeners: readonly (readonly [string, (e: Event) => void, boolean])[] = [
    ["pointermove", move, true],
    ["pointerdown", move, true],
    ["pointerleave", leave, false],
    ["pointercancel", leave, false],
  ];
  for (const [type, fn, capture] of listeners) svg.addEventListener(type, fn, { capture });
  return {
    update(points) {
      index(points);
      cur = undefined; // the same id may now sit elsewhere: the next event re-places the tooltip
    },
    destroy() {
      for (const [type, fn, capture] of listeners) svg.removeEventListener(type, fn, { capture });
      tip?.destroy();
      if (wrote !== null && wrote.size > 0 && store.getState().hover === wrote) store.set({ hover: [] });
      cur = undefined;
      wrote = null;
    },
  };
}
