import { type BrushSelection, type D3BrushEvent, brush, brushX, brushY, select } from "d3";
import { InputError } from "../errors.js";
import { type RowFilter, type SelectionStore, toId } from "../selection.js";
import { hasDom } from "./highlight.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A row field name, or an accessor. Index-based accessors cannot apply: linked tables re-test their own rows. */
export type Field<R> = (keyof R & string) | ((row: R) => unknown);
/**
 * What `brushFilter` brushes: the figure's rows, the fields its brushed axes encode (x and y, or one alone), each row's
 * link id, what a brush holding no row means, and the scales of a chart that has no `figure.scale`.
 */
export interface BrushFilterOptions<R> {
  /** The rows the figure was drawn from. */
  data: readonly R[];
  /** The field the figure's x scale encodes. Without `y`, a 1-D brush along x over the svg's full height. */
  x?: Field<R>;
  /** The field the figure's y scale encodes. Without `x`, a 1-D brush along y over the svg's full width. */
  y?: Field<R>;
  /** The link id per row: the same values as the marks' `id` / `linkIds` channel. Default: the row index. */
  id?: Field<R>;
  /**
   * A brush that holds no row. `"dim"` (the default): its region stays in the store, so every mark dims and a linked
   * table shows no row. `"clear"`: it is no filter at all; the store goes idle and, when the gesture ends, the drawn
   * rectangle is removed (a date window over the All-Star break selects no game, and left drawn would look applied).
   */
  empty?: "dim" | "clear";
  /**
   * The brushed axes' scales, overriding `figure.scale`: how a d3-drawn chart, which has none, is brushed. A d3 scale
   * goes in as it is (`d3.scaleUtc()`, whose `range()` is a method); a {@link ScaleLike} works too.
   */
  scales?: { x?: ScaleLike | D3ScaleLike; y?: ScaleLike | D3ScaleLike };
}
/** A live brush: drive it programmatically, or remove it. */
export interface BrushFilterHandle {
  /**
   * Brush a region in DATA coordinates, one range per brushed axis (`null` clears), as if the user had dragged it. Rows
   * are tested against these exact bounds, never their pixel round trip: a row on a bound is inside.
   */
  move(region: { x?: readonly [unknown, unknown]; y?: readonly [unknown, unknown] } | null): void;
  /** Remove the overlay and stop following the store; clears its selection and predicate if this brush set them. */
  destroy(): void;
}
/** The slice of a materialised Plot scale the brush reads (`plot.scale("x")`); structural, so no Plot import. */
export interface ScaleLike {
  /** Data value to pixel. */
  apply(value: unknown): unknown;
  /** Pixel to data value; absent on band and point scales, which a brush cannot invert. */
  invert?(pixel: unknown): unknown;
  /** The pixel range; the brush's extent spans it. Absent (or with no finite value), the svg's box on that axis. */
  range?: Iterable<unknown>;
}
/**
 * A d3-scale continuous scale as `d3.scaleLinear()` or `d3.scaleUtc()` makes it: callable, with `invert`, and with
 * `range()` a METHOD (a {@link ScaleLike}'s `range` is the pixels themselves). `brushFilter` adapts it.
 */
export interface D3ScaleLike {
  /** Data value to pixel. */
  (value: never): unknown;
  /** Pixel to data value; absent on band and point scales, which a brush cannot invert. */
  invert?(pixel: number): unknown;
  /** The pixel range, read once when the brush is made. */
  range(): Iterable<unknown>;
}
/**
 * What `Plot.plot` returns: the `<svg>`, or a `<figure>` wrapping it, exposing its scales. Any `<svg>` fits: a d3-drawn
 * chart has no `scale` and passes `scales` instead.
 */
export type PlotFigure = Element & { scale?(name: "x" | "y"): ScaleLike | undefined };

const get = <R>(row: R, f: Field<R>): unknown => (typeof f === "function" ? f(row) : row[f]);
/** Missing values are never inside a brush: `Number(null)` is 0, which a range spanning 0 would wrongly admit. */
const num = (v: unknown): number => (v === null || v === undefined || v === "" ? Number.NaN : Number(v));
const span = (a: unknown, b: unknown): [number, number] => {
  const p = num(a);
  const q = num(b);
  return p <= q ? [p, q] : [q, p];
};
const NOOP: BrushFilterHandle = { move: () => {}, destroy: () => {} };
/** A d3 scale is a function: its `range` is a method and its `apply` is Function.prototype's. Never read it as is. */
const scaleOf = (s: ScaleLike | D3ScaleLike | undefined): ScaleLike | undefined => {
  if (typeof s !== "function") return s;
  const f = s as unknown as (value: unknown) => unknown;
  const inv = s.invert;
  return {
    apply: (v) => f(v),
    ...(inv && { invert: (p: unknown) => inv.call(s, Number(p)) }),
    range: s.range(),
  };
};
/** The svg's user-space box: its viewBox, else its width and height. A 1-D brush spans the other axis entirely. */
const boxOf = (svg: Element): [number, number, number, number] => {
  const v = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (v.length === 4 && v.every(Number.isFinite)) return v as [number, number, number, number];
  return [0, 0, Number(svg.getAttribute("width")) || 0, Number(svg.getAttribute("height")) || 0];
};

/**
 * Overlay a d3-brush on a rendered Plot figure, or on a d3-drawn `<svg>` given its own `scales`. Each brush move sets
 * the store's `predicate` (the region as a row test, for linked tables) and `selected` (the ids of `data` inside it,
 * for highlighting) in ONE notification. Pass `x` and `y` for a rectangle, or one of them for a 1-D brush across the
 * whole svg (a date window on a timeline). Clearing the brush, or a click on the empty chart, clears both, but only
 * while the store still holds this brush's region. A selection made elsewhere since (a table row, a toggled mark)
 * survives, and so does one made before that holds exactly the brushed ids: the store kept that set, so the brush
 * wrote none of its own. The drawn brush follows the store: when its region is cleared or replaced elsewhere, the
 * rectangle is removed with no second write. `empty` says what a brush holding no row means. The overlay is inserted
 * BEHIND the marks, so hovering a mark still reaches it. On a figure with a Plot `tip`, the press that starts a brush also pins the tip showing at
 * that moment (Plot's pointer toggles a sticky tip on `pointerdown`); the brush still works. Throws `InputError`
 * without `x` or `y`, or unless each brushed axis has a continuous (invertible) scale, in Node too. Returns a HANDLE,
 * not a teardown function, because a brush has more to do than tear down: `move` drives it and `destroy` removes it
 * (`linkSelection` and `linkCursor`, whose teardown is all they have, return a function). A no-op handle without a DOM.
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
 *
 * @example A 1-D date window that clears when it holds no game
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { brushFilter } from "@sportsdataverse/sdvplot/interact";
 * import { linkIds } from "@sportsdataverse/sdvplot/plot";
 *
 * // five of Brooklyn's 2025-26 games
 * const games = [
 *   { game_id: "0022500130", game_date: "2025-10-29", matchup: "BKN vs. ATL" },
 *   { game_id: "0022500149", game_date: "2025-11-02", matchup: "BKN vs. PHI" },
 *   { game_id: "0022500156", game_date: "2025-11-03", matchup: "BKN vs. MIN" },
 *   { game_id: "0022500173", game_date: "2025-11-05", matchup: "BKN @ IND" },
 *   { game_id: "0022500031", game_date: "2025-11-07", matchup: "BKN vs. DET" },
 * ];
 * const day = (g: (typeof games)[number]): Date => new Date(`${g.game_date}T00:00:00Z`);
 * const svg = Plot.plot({
 *   height: 60,
 *   x: { type: "utc" },
 *   marks: [Plot.tickX(games, { x: day, render: linkIds(games, "game_id") })],
 * });
 * const store = createSelection<(typeof games)[number]>();
 * // x alone: a brush along the dates; "clear": a window holding no game is no filter and is not left drawn
 * const brush = brushFilter(svg, store, { data: games, x: day, id: "game_id", empty: "clear" });
 * brush.move({ x: [new Date("2025-11-01"), new Date("2025-11-06")] });
 * [...store.getState().selected]; // ["0022500149", "0022500156", "0022500173"]
 * ```
 *
 * @example A d3-drawn chart brushed through its own d3 scale
 * ```ts
 * import { scaleUtc, select } from "d3";
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { brushFilter } from "@sportsdataverse/sdvplot/interact";
 *
 * // five of Brooklyn's 2025-26 games
 * const games = [
 *   { game_id: "0022500130", game_date: "2025-10-29", matchup: "BKN vs. ATL" },
 *   { game_id: "0022500149", game_date: "2025-11-02", matchup: "BKN vs. PHI" },
 *   { game_id: "0022500156", game_date: "2025-11-03", matchup: "BKN vs. MIN" },
 *   { game_id: "0022500173", game_date: "2025-11-05", matchup: "BKN @ IND" },
 *   { game_id: "0022500031", game_date: "2025-11-07", matchup: "BKN vs. DET" },
 * ];
 * const day = (g: (typeof games)[number]): Date => new Date(`${g.game_date}T00:00:00Z`);
 * const x = scaleUtc([new Date("2025-10-28"), new Date("2025-11-08")], [10, 630]);
 * const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
 * svg.setAttribute("viewBox", "0 0 640 60");
 * select(svg)
 *   .selectAll("rect")
 *   .data(games)
 *   .join("rect")
 *   .attr("x", (g) => x(day(g)) - 1.5)
 *   .attr("y", 6)
 *   .attr("width", 3)
 *   .attr("height", 40)
 *   .attr("data-sdv-id", (g) => g.game_id); // the stamp linkIds would write
 * const store = createSelection<(typeof games)[number]>();
 * // no figure.scale on a d3 chart: pass the d3 scale itself (its range() is a method; brushFilter reads it)
 * brushFilter(svg, store, { data: games, x: day, id: "game_id", scales: { x } }).move({
 *   x: [new Date("2025-11-04"), new Date("2025-11-08")],
 * });
 * [...store.getState().selected]; // ["0022500173", "0022500031"]
 * ```
 */
export function brushFilter<R>(
  figure: PlotFigure,
  store: SelectionStore<R>,
  o: BrushFilterOptions<R>,
): BrushFilterHandle {
  if (o.x === undefined && o.y === undefined)
    throw new InputError("brushFilter needs x, y or both: the fields its brushed axes encode");
  if (o.empty !== undefined && o.empty !== "dim" && o.empty !== "clear")
    throw new InputError(`brushFilter: empty is "dim" or "clear", not ${JSON.stringify(o.empty)}`);
  const xs = o.x === undefined ? undefined : scaleOf(o.scales?.x ?? figure.scale?.("x"));
  const ys = o.y === undefined ? undefined : scaleOf(o.scales?.y ?? figure.scale?.("y"));
  if ((o.x !== undefined && !xs?.invert) || (o.y !== undefined && !ys?.invert))
    throw new InputError(
      "brushFilter needs continuous x and y scales on the axes it brushes; band and point scales cannot be inverted, and a chart without figure.scale passes `scales`",
    );
  if (!hasDom()) return NOOP;
  const svg =
    figure.tagName.toLowerCase() === "svg"
      ? figure
      : Array.from(figure.querySelectorAll(":scope > svg")).at(-1);
  if (!svg) throw new InputError("brushFilter: no <svg> in the figure");
  const [bx, by, bw, bh] = boxOf(svg);
  /** The axis' pixel extent: the scale's range, else (no scale, or no finite range) the svg's box, as linkCursor's. */
  const pixels = (s: ScaleLike | undefined, from: number, to: number): [number, number] => {
    const r = Array.from(s?.range ?? [], Number).filter(Number.isFinite);
    return r.length > 0 ? [Math.min(...r), Math.max(...r)] : [from, to];
  };
  const [x0px, x1px] = pixels(xs, bx, bx + bw);
  const [y0px, y1px] = pixels(ys, by, by + bh);
  const node = svg.ownerDocument.createElementNS(SVG_NS, "g");
  node.setAttribute("class", "sdv-brush");
  svg.insertBefore(node, svg.firstChild);
  const g = select<SVGGElement, unknown>(node);
  let mine: RowFilter<R> | null = null;
  let picked: ReadonlySet<string> | null = null; // the `selected` this brush wrote with `mine`
  let last = ""; // d3 emits "brush" then "end" for one gesture: one store update per distinct region
  // move()'s own data region while d3 emits it (synchronously): the pixel round trip is inexact, and
  // invert(apply(10)) = 10.000000000000002 would leave a row at 10 outside a brush starting at 10
  let asked: { x?: [number, number]; y?: [number, number] } | null = null;
  const idOf = (row: R, i: number): string => (o.id === undefined ? String(i) : toId(get(row, o.id)));
  const b = (xs && ys ? brush<unknown>() : xs ? brushX<unknown>() : brushY<unknown>()).extent([
    [x0px, y0px],
    [x1px, y1px],
  ]);
  /**
   * The brush's region is gone: clear the store only while it still holds that region (main: the window alone), and
   * `selected` only while it is still the set this brush wrote: a pick another control made since survives.
   */
  const release = (): void => {
    last = "";
    if (mine === null) return;
    const own = store.getState().selected === picked;
    mine = null;
    picked = null;
    store.set(own ? { selected: [], predicate: null } : { predicate: null });
  };
  // Remove the drawn rectangle. Always called with `mine` already null, so the null selection d3 then emits releases
  // nothing: the erasure writes nothing (main ignores its programmatic moves the same way, timeline.ts:57).
  const erase = (): void => {
    g.call(b.move, null);
  };
  b.on("brush end", (event: D3BrushEvent<unknown>) => {
    const sel: BrushSelection | null = event.selection;
    if (sel === null) return release();
    // a 1-D brush reports [p0, p1] along its axis; a 2-D one [[x0, y0], [x1, y1]]
    const [px, py]: [readonly number[] | null, readonly number[] | null] =
      typeof sel[0] === "number"
        ? xs
          ? [sel as [number, number], null]
          : [null, sel as [number, number]]
        : [
            [sel[0][0], (sel[1] as [number, number])[0]],
            [sel[0][1], (sel[1] as [number, number])[1]],
          ];
    const tests: [Field<R>, number, number][] = [];
    if (o.x !== undefined && px)
      tests.push([o.x, ...(asked?.x ?? span(xs?.invert?.(px[0]), xs?.invert?.(px[1])))]);
    if (o.y !== undefined && py)
      tests.push([o.y, ...(asked?.y ?? span(ys?.invert?.(py[0]), ys?.invert?.(py[1])))]);
    const key = tests.map(([, lo, hi]) => `${lo}|${hi}`).join("|");
    if (key === last) return;
    const inside: RowFilter<R> = (row) =>
      tests.every(([f, lo, hi]) => {
        const v = num(get(row, f));
        return v >= lo && v <= hi;
      });
    // ponytail: linear scan per move (10k rows well under a frame); d3.quadtree if data passes ~100k
    const ids = o.data.flatMap((row, i) => (inside(row) ? [idOf(row, i)] : []));
    if (ids.length === 0 && o.empty === "clear") {
      release();
      if (event.type === "end") erase(); // main timeline.ts:35-43: an empty window left drawn would look applied
      return;
    }
    last = key;
    mine = inside;
    const had = store.getState().selected;
    store.set({ selected: ids, predicate: inside });
    const now = store.getState().selected;
    // the brush owns `selected` by identity: the set its write made, or one it already owned. An equal set another
    // control selected first keeps its identity (the store drops a no-op), so it stays that control's
    picked = now !== had || had === picked ? now : null;
  });
  g.call(b);
  // The drawn brush follows the store: a region cleared or replaced elsewhere (a "Clear dates" button, another brush)
  // removes the rectangle, writing nothing.
  const off = store.subscribe((s) => {
    if (mine === null || s.predicate === mine) return;
    mine = null;
    erase();
  });
  const at = (s: ScaleLike | undefined, r: readonly [unknown, unknown] | undefined, axis: string) => {
    if (s === undefined) return null;
    if (r === undefined)
      throw new InputError(`brushFilter: move needs region.${axis}, the brushed ${axis} range`);
    return span(s.apply(r[0]), s.apply(r[1]));
  };
  return {
    move(region) {
      if (region === null) {
        g.call(b.move, null);
        return;
      }
      const px = at(xs, region.x, "x");
      const py = at(ys, region.y, "y");
      asked = {
        ...(px && region.x && { x: span(region.x[0], region.x[1]) }),
        ...(py && region.y && { y: span(region.y[0], region.y[1]) }),
      };
      try {
        g.call(
          b.move,
          px && py
            ? [
                [px[0], py[0]],
                [px[1], py[1]],
              ]
            : (px ?? py),
        );
      } finally {
        asked = null;
      }
    },
    destroy() {
      off();
      node.remove();
      if (mine !== null && store.getState().predicate === mine) release();
    },
  };
}
