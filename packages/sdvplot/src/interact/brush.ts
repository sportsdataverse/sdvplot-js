import { type D3BrushEvent, brush, select } from "d3";
import { InputError } from "../errors.js";
import { type RowFilter, type SelectionStore, toId } from "../selection.js";
import { hasDom } from "./highlight.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A row field name, or an accessor. Index-based accessors cannot apply: linked tables re-test their own rows. */
export type Field<R> = (keyof R & string) | ((row: R) => unknown);
/** What `brushFilter` brushes: the figure's rows, the fields its x and y scales encode, and each row's link id. */
export interface BrushFilterOptions<R> {
  /** The rows the figure was drawn from. */
  data: readonly R[];
  /** The field the figure's x scale encodes. */
  x: Field<R>;
  /** The field the figure's y scale encodes. */
  y: Field<R>;
  /** The link id per row: the same values as the marks' `id` / `linkIds` channel. Default: the row index. */
  id?: Field<R>;
}
/** A live brush: drive it programmatically, or remove it. */
export interface BrushHandle {
  /** Brush a region in DATA coordinates (`null` clears), as if the user had dragged it. */
  move(region: { x: readonly [unknown, unknown]; y: readonly [unknown, unknown] } | null): void;
  /** Remove the overlay; clears the store's selection and predicate if this brush set them. */
  destroy(): void;
}
/** The slice of a materialised Plot scale the brush reads (`plot.scale("x")`); structural, so no Plot import. */
export interface ScaleLike {
  /** Data value to pixel. */
  apply(value: unknown): unknown;
  /** Pixel to data value; absent on band and point scales, which a brush cannot invert. */
  invert?(pixel: unknown): unknown;
  /** The pixel range; the brush's extent spans it. */
  range?: Iterable<unknown>;
}
/** What `Plot.plot` returns: the `<svg>`, or a `<figure>` wrapping it, exposing its scales. */
export type PlotFigure = Element & { scale(name: "x" | "y"): ScaleLike | undefined };

const get = <R>(row: R, f: Field<R>): unknown => (typeof f === "function" ? f(row) : row[f]);
/** Missing values are never inside a brush: `Number(null)` is 0, which a range spanning 0 would wrongly admit. */
const num = (v: unknown): number => (v === null || v === undefined || v === "" ? Number.NaN : Number(v));
const span = (a: unknown, b: unknown): [number, number] => {
  const p = num(a);
  const q = num(b);
  return p <= q ? [p, q] : [q, p];
};
const NOOP: BrushHandle = { move: () => {}, destroy: () => {} };

/**
 * Overlay a d3-brush on a rendered Plot figure. Each brush move sets the store's `predicate` (the region as a row
 * test, for linked tables) and `selected` (the ids of `data` inside it, for highlighting) in ONE notification;
 * clearing the brush clears both. The overlay is inserted BEHIND the marks, so hovering a mark still reaches it. On a
 * figure with a Plot `tip`, the press that starts a brush also pins the tip showing at that moment (Plot's pointer
 * toggles a sticky tip on `pointerdown`); the brush still works. Throws `InputError` unless x and y are continuous
 * (invertible) scales, in Node too. A no-op handle without a DOM.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { brushFilter } from "@sportsdataverse/sdvplot/interact";
 * import { linkIds } from "@sportsdataverse/sdvplot/plot";
 *
 * const rows = [
 *   { team: "KC", wins: 15, net_epa: 0.063 },
 *   { team: "LAC", wins: 11, net_epa: 0.101 },
 *   { team: "MIA", wins: 8, net_epa: -0.019 },
 * ];
 * const svg = Plot.plot({ marks: [Plot.dot(rows, { x: "wins", y: "net_epa", render: linkIds(rows, "team") })] });
 * const store = createSelection<(typeof rows)[number]>();
 * const brush = brushFilter(svg, store, { data: rows, x: "wins", y: "net_epa", id: "team" });
 * brush.move({ x: [10, 16], y: [0, 0.15] }); // drag over the 10+ win teams with a positive net EPA
 * [...store.getState().selected]; // ["KC", "LAC"]
 * ```
 */
export function brushFilter<R>(
  figure: PlotFigure,
  store: SelectionStore<R>,
  o: BrushFilterOptions<R>,
): BrushHandle {
  const xs = figure.scale("x");
  const ys = figure.scale("y");
  if (!xs?.invert || !ys?.invert)
    throw new InputError(
      "brushFilter needs continuous x and y scales; band and point scales cannot be inverted",
    );
  if (!hasDom()) return NOOP;
  const xr = Array.from(xs.range ?? [], Number);
  const yr = Array.from(ys.range ?? [], Number);
  const svg =
    figure.tagName.toLowerCase() === "svg"
      ? figure
      : Array.from(figure.querySelectorAll(":scope > svg")).at(-1);
  if (!svg) throw new InputError("brushFilter: no <svg> in the figure");
  const node = svg.ownerDocument.createElementNS(SVG_NS, "g");
  node.setAttribute("class", "sdv-brush");
  svg.insertBefore(node, svg.firstChild);
  const g = select<SVGGElement, unknown>(node);
  let mine: RowFilter<R> | null = null;
  let last = ""; // d3 emits "brush" then "end" for one gesture: one store update per distinct region
  const idOf = (row: R, i: number): string => (o.id === undefined ? String(i) : toId(get(row, o.id)));
  const b = brush<unknown>()
    .extent([
      [Math.min(...xr), Math.min(...yr)],
      [Math.max(...xr), Math.max(...yr)],
    ])
    .on("brush end", (event: D3BrushEvent<unknown>) => {
      const sel = event.selection as [[number, number], [number, number]] | null;
      if (sel === null) {
        mine = null;
        last = "";
        store.set({ selected: [], predicate: null });
        return;
      }
      const [[px0, py0], [px1, py1]] = sel;
      const [x0, x1] = span(xs.invert?.(px0), xs.invert?.(px1));
      const [y0, y1] = span(ys.invert?.(py0), ys.invert?.(py1));
      const key = `${x0}|${x1}|${y0}|${y1}`;
      if (key === last) return;
      last = key;
      const inside: RowFilter<R> = (row) => {
        const x = num(get(row, o.x));
        const y = num(get(row, o.y));
        return x >= x0 && x <= x1 && y >= y0 && y <= y1;
      };
      // ponytail: linear scan per move (10k rows well under a frame); d3.quadtree if data passes ~100k
      const ids = o.data.flatMap((row, i) => (inside(row) ? [idOf(row, i)] : []));
      mine = inside;
      store.set({ selected: ids, predicate: inside });
    });
  g.call(b);
  return {
    move(region) {
      if (region === null) {
        g.call(b.move, null);
        return;
      }
      const [px0, px1] = span(xs.apply(region.x[0]), xs.apply(region.x[1]));
      const [py0, py1] = span(ys.apply(region.y[0]), ys.apply(region.y[1]));
      g.call(b.move, [
        [px0, py0],
        [px1, py1],
      ]);
    },
    destroy() {
      node.remove();
      if (mine !== null && store.getState().predicate === mine) store.set({ selected: [], predicate: null });
    },
  };
}
