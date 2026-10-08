import { pointer } from "d3";
import { InputError } from "../errors.js";
import { type Cursor, type SelectionStore, sameCursor } from "../selection.js";
import { type D3ScaleLike, type PlotFigure, type ScaleLike, scaleOf } from "./brush.js";
import { hasDom } from "./highlight.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** A13: custom properties with fallbacks, so a page's light/dark tokens restyle every cursor with no JS. */
const CSS =
  ".sdv-cursor line,.sdv-cursor ellipse{fill:none;stroke:var(--sdv-cursor-color,rgba(0,0,0,.2));stroke-width:var(--sdv-cursor-width,10px)}" +
  ".sdv-cursor rect{fill:var(--sdv-cursor-color,rgba(0,0,0,.2))}.sdv-cursor circle{fill:currentColor}";
/** Master's readout flips once the distance reaches 30 of the chart's 35 ft (`BarChart/Cursor.js:7,20-22`). */
const FLIP_AT = 30 / 35;

/** A scale a cursor maps through: a {@link ScaleLike}, plus a band scale's width and domain. */
export interface BandScaleLike extends ScaleLike {
  /** The band width in pixels. A number marks a band scale, whose domain values are the bands' first values. */
  readonly bandwidth?: number;
  /** The domain; a band scale's must be all numbers. */
  readonly domain?: Iterable<unknown>;
}
/**
 * What a figure draws for the cursor. `axis: "x" | "y"`: a rule across the plot at the value, or with `width` a band
 * `width` data units wide centred on it, or on a band scale (`bandwidth`) the band holding it. `cross` is the other
 * axis' scale: the rule spans its range (default: the figure's own other scale on a Plot figure, else the svg's
 * viewBox). `axis: "ring"`: an ellipse around `center` (data coordinates) whose radii are the value mapped through the
 * x and y scales, such as a shot distance around the hoop. Every scale is a Plot figure's (`svg.scale("x")`) or a d3
 * scale as it is ({@link D3ScaleLike}: `d3.scaleLinear()`, `d3.scaleBand()`), as `brushFilter`'s `scales` are.
 */
export type CursorShape =
  | {
      readonly axis: "x" | "y";
      readonly scale: BandScaleLike | D3ScaleLike;
      readonly width?: number;
      readonly cross?: ScaleLike | D3ScaleLike;
    }
  | {
      readonly axis: "ring";
      readonly x: ScaleLike | D3ScaleLike;
      readonly y: ScaleLike | D3ScaleLike;
      readonly center: readonly [number, number];
    };
/** How {@link linkCursor} follows and emits the store's cursor. */
export interface LinkCursorOptions {
  /** The cursor field this figure draws and emits, such as `"shot_distance"`; a cursor naming another field hides it. */
  readonly field: string;
  /** What to draw, through which scale. */
  readonly shape: CursorShape;
  /** Write the value under the pointer to the store. Default `true` for `"x"` / `"y"`; a ring never emits. */
  readonly emit?: boolean;
  /** Snap an emitted value on a linear scale, such as `(v) => Math.floor(v) + 0.5` for 1 ft bins. Default: none. */
  readonly snap?: (value: number) => number;
  /** A readout beside an `"x"` cursor, one line per string. */
  readonly label?: (value: number) => readonly string[];
  /** Past this fraction of the axis' pixel range (0, 1] the readout flips to the cursor's left. Default 30 / 35. */
  readonly flipAt?: number;
  /** A dot on the cursor at this OTHER-axis data value (a curve's value there); `null` hides it. Needs `cross`. */
  readonly dot?: (value: number) => number | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const extent = (r: Iterable<unknown> | undefined): [number, number] | null => {
  const a = Array.from(r ?? [], Number).filter(Number.isFinite);
  return a.length > 0 ? [Math.min(...a), Math.max(...a)] : null;
};
/** The svg's user-space box: its viewBox, else its width and height. */
const box = (svg: Element): { x: [number, number]; y: [number, number] } => {
  const v = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [x, y, w, h] =
    v.length === 4 && v.every(Number.isFinite)
      ? v
      : [0, 0, Number(svg.getAttribute("width")) || 0, Number(svg.getAttribute("height")) || 0];
  return { x: [x ?? 0, (x ?? 0) + (w ?? 0)], y: [y ?? 0, (y ?? 0) + (h ?? 0)] };
};

/**
 * Draw the store's cursor (J34: one shared hover VALUE, such as a shot distance) through THIS figure's own scale, and
 * write the value under the pointer back. Every linked chart follows the same number its own way: a band on share bars
 * (linear x), the band holding it on FG% bars (a band scale), a band on a side chart (y), a rule on a curve, a ring
 * around the hoop. Moving inside one snapped bin writes nothing; crossing a bin edge is one update; leaving the figure
 * (`pointerleave`, `pointercancel`) or the axis' range clears the cursor this figure wrote, while the store still holds
 * it: never one an app `store.set` or another figure wrote since, nor an equal one set before (the store kept that one,
 * so this figure wrote none). A cursor never dims marks or filters a table (it is not an id). A store change moves
 * attributes only: no element is added or removed, so a cursor costs O(1) per figure. The move and press listeners
 * capture, so a Plot `tip` that stops a press from reaching other listeners does not stop this one; the leave listeners
 * do not, so a mark's own `pointerleave` (the pointer crossing a bar's edge inside one bin) writes nothing. Styled by
 * `--sdv-cursor-color` and `--sdv-cursor-width`. Returns a teardown FUNCTION, not a handle, because teardown is all it
 * has (as `linkSelection`'s; `brushFilter`, `nearestHover` and `tooltip` return a handle with `destroy()`). The scales'
 * pixel ranges are read once, so after a resize, relink. The teardown removes the cursor and its listeners, and clears
 * the store's cursor when it still holds the one this figure last wrote (as `linkSelection`'s teardown does with its
 * hover): a chart redrawn under the pointer leaves no cursor that no pointer drives. Throws `InputError` on a bad
 * option, in Node too; a no-op without a DOM.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { linkCursor } from "@sportsdataverse/sdvplot/interact";
 * import { fgPctByDistance } from "@sportsdataverse/sdvplot/shots";
 *
 * // Brooklyn shots from the sportsdataverse-data nba_stats_shots release, 2025-26
 * const shots = [
 *   { x_legacy: -1, y_legacy: 7, shot_distance: 1, shot_value: 2, shot_result: "Made" },
 *   { x_legacy: 0, y_legacy: 0, shot_distance: 0, shot_value: 2, shot_result: "Missed" },
 *   { x_legacy: -44, y_legacy: 252, shot_distance: 26, shot_value: 3, shot_result: "Made" },
 * ];
 * const bins = fgPctByDistance(shots, 1, 30);
 * const svg = Plot.plot({
 *   x: { label: "Shot distance (ft)" },
 *   marks: [Plot.rectY(bins, { x1: "distance", x2: (b) => b.distance + 1, y: "attempts" })],
 * });
 * const store = createSelection();
 * linkCursor(svg, store, {
 *   field: "shot_distance",
 *   shape: { axis: "x", scale: svg.scale("x")!, width: 1 },
 *   snap: (feet) => Math.floor(feet) + 0.5, // one value per 1 ft bin
 *   label: (feet) => [`@ ${Math.floor(feet)} ft`],
 * });
 * store.set({ cursor: { field: "shot_distance", value: 26.5 } }); // what a pointer 26.3 ft out writes
 * svg; // the 26-27 ft band shaded, with its readout
 * ```
 */
export function linkCursor<R>(root: Element, store: SelectionStore<R>, o: LinkCursorOptions): () => void {
  const { shape } = o;
  if (typeof o.field !== "string" || o.field === "")
    throw new InputError("linkCursor needs a non-empty cursor field");
  if (typeof shape !== "object" || shape === null)
    throw new InputError("linkCursor needs a shape: what to draw");
  if (shape.axis !== "x" && shape.axis !== "y" && shape.axis !== "ring")
    throw new InputError(`linkCursor shape.axis must be "x", "y" or "ring", got ${String(shape.axis)}`);
  if (o.flipAt !== undefined && !(o.flipAt > 0 && o.flipAt <= 1))
    throw new InputError(`linkCursor flipAt must be in (0, 1], got ${String(o.flipAt)}`);
  // a d3 scale is adapted once (A6): its range, bandwidth and domain are methods, its apply Function.prototype's
  const ring = shape.axis === "ring" ? { ...shape, x: scaleOf(shape.x), y: scaleOf(shape.y) } : null;
  const line =
    shape.axis === "ring" ? null : { ...shape, scale: scaleOf(shape.scale), cross: scaleOf(shape.cross) };
  // a JavaScript caller can leave one out: name it here, in Node too, never a TypeError (or a throw in the browser later)
  const isScale = (s: unknown): boolean =>
    typeof (s as { apply?: unknown } | undefined)?.apply === "function";
  if (
    ring
      ? !isScale(ring.x) || !isScale(ring.y)
      : !isScale(line?.scale) || (line?.cross !== undefined && !isScale(line.cross))
  )
    throw new InputError(
      `linkCursor: shape.${ring ? "x and shape.y" : line?.cross === undefined ? "scale" : "scale and shape.cross"} must be scales, a Plot figure's or d3's`,
    );
  if (ring) {
    // exactly two: every() is vacuously true on [], which would leave the ring hidden for good
    const c: unknown = ring.center;
    if (!Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite))
      throw new InputError(`linkCursor ring center must be two finite numbers, got ${JSON.stringify(c)}`);
    if (o.emit === true) throw new InputError("linkCursor: a ring follows the cursor but never emits it");
    if (o.label || o.dot)
      throw new InputError("linkCursor: label and dot are for an x or y cursor, not a ring");
  }
  if (line?.width !== undefined && !(isNum(line.width) && line.width > 0))
    throw new InputError(`linkCursor shape.width must be a finite number > 0, got ${String(line.width)}`);
  if (line?.axis === "y" && o.label)
    throw new InputError("linkCursor: label is a readout beside an x cursor");
  // a band scale: its sorted numeric domain, each value the start of a band that runs to the next start
  let starts: number[] | null = null;
  if (line && typeof line.scale.bandwidth === "number") {
    const d = Array.from(line.scale.domain ?? []);
    if (d.length === 0 || !d.every(isNum))
      throw new InputError("linkCursor: a band scale's domain must be numbers, each band's first value");
    starts = [...d].sort((a, b) => a - b);
  }
  const emit = line !== null && o.emit !== false;
  if (emit && starts === null && typeof line?.scale.invert !== "function")
    throw new InputError("linkCursor: emitting needs a scale with invert (linear) or a bandwidth (band)");
  const figure = root as Partial<PlotFigure>;
  const cross: ScaleLike | undefined =
    line?.cross ??
    (line && typeof figure.scale === "function" ? figure.scale(line.axis === "x" ? "y" : "x") : undefined);
  if (o.dot && !cross) throw new InputError("linkCursor: dot needs a cross scale (shape.cross)");
  if (!hasDom()) return () => {};

  const svg =
    root.tagName.toLowerCase() === "svg" ? root : Array.from(root.querySelectorAll(":scope > svg")).at(-1);
  if (!svg) throw new InputError("linkCursor: no <svg> in the root");
  const doc = svg.ownerDocument;
  const make = (tag: string, parent: Element): Element => {
    const el = doc.createElementNS(SVG_NS, tag);
    parent.append(el);
    return el;
  };
  if (!svg.querySelector(':scope > style[data-sdv-interact="cursor"]')) {
    const style = make("style", svg);
    style.setAttribute("data-sdv-interact", "cursor");
    style.textContent = CSS;
  }
  const g = make("g", svg);
  g.setAttribute("class", "sdv-cursor");
  g.setAttribute("pointer-events", "none");
  g.setAttribute("display", "none");
  const mark = make(ring ? "ellipse" : starts || line?.width ? "rect" : "line", g);
  const text = o.label ? make("text", g) : null;
  const tspans: { el: Element; line: Text }[] = [];
  const circle = o.dot ? make("circle", g) : null;
  circle?.setAttribute("r", "3");

  const vb = box(svg);
  const along = line ? (extent(line.scale.range) ?? vb[line.axis]) : vb.x;
  const across = line ? (extent(cross?.range) ?? vb[line.axis === "x" ? "y" : "x"]) : vb.y;
  /** The band `i` covers [starts[i], end(i)): the next start, or one step past the last (a single band never ends). */
  const end = (s: number[], i: number): number => {
    const next = s[i + 1];
    if (next !== undefined) return next;
    const last = s[i] ?? 0;
    const prev = s[i - 1];
    return prev === undefined ? Number.POSITIVE_INFINITY : last + (last - prev);
  };
  const set = (el: Element, attrs: Record<string, number | string>): void => {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  };
  /** Where an axis cursor sits for `v`, in pixels along its axis: [low edge, high edge, centre]; null if nowhere. */
  const place = (v: number): [number, number, number] | null => {
    if (!line) return null;
    const px = (d: number): number => Number(line.scale.apply(d));
    let lo: number;
    let hi: number;
    let mid: number;
    if (starts) {
      let i = -1;
      for (let k = 0; k < starts.length && (starts[k] ?? 0) <= v; k++) i = k;
      if (i < 0 || v >= end(starts, i)) return null;
      lo = px(starts[i] ?? 0);
      hi = lo + (line.scale.bandwidth ?? 0);
      mid = (lo + hi) / 2;
    } else {
      const w = (line.width ?? 0) / 2;
      const [p, q] = [px(v - w), px(v + w)];
      [lo, hi, mid] = [Math.min(p, q), Math.max(p, q), px(v)];
    }
    return [lo, hi, mid].every(Number.isFinite) ? [lo, hi, mid] : null;
  };
  const draw = (c: Cursor | null): void => {
    const v = c?.value;
    if (v === undefined) {
      g.setAttribute("display", "none");
      return;
    }
    if (ring) {
      const [c0, c1] = ring.center;
      const cx = Number(ring.x.apply(c0));
      const cy = Number(ring.y.apply(c1));
      const rx = Math.abs(Number(ring.x.apply(c0 + v)) - cx);
      const ry = Math.abs(Number(ring.y.apply(c1 + v)) - cy);
      if (![cx, cy, rx, ry].every(Number.isFinite)) {
        g.setAttribute("display", "none");
        return;
      }
      set(mark, { cx, cy, rx, ry });
      g.removeAttribute("display");
      return;
    }
    const at = place(v);
    if (!line || !at) {
      g.setAttribute("display", "none");
      return;
    }
    const [lo, hi, mid] = at;
    const [a0, a1] = across;
    const x = line.axis === "x";
    if (mark.tagName === "rect")
      set(
        mark,
        x
          ? { x: lo, width: hi - lo, y: a0, height: a1 - a0 }
          : { y: lo, height: hi - lo, x: a0, width: a1 - a0 },
      );
    else set(mark, x ? { x1: mid, x2: mid, y1: a0, y2: a1 } : { y1: mid, y2: mid, x1: a0, x2: a1 });
    if (text && o.label) {
      const lines = o.label(v);
      const [p0, p1] = along;
      const flip = (mid - p0) / (p1 - p0 || 1) > (o.flipAt ?? FLIP_AT);
      while (tspans.length < lines.length) {
        const el = make("tspan", text); // ponytail: added once, the first time a readout needs this many lines
        el.setAttribute("dy", tspans.length === 0 ? "1em" : "1.3em");
        const t = doc.createTextNode("");
        el.append(t);
        tspans.push({ el, line: t });
      }
      set(text, { y: a0, "text-anchor": flip ? "end" : "start" });
      for (const [i, { el, line: t }] of tspans.entries()) {
        el.setAttribute("x", String(flip ? lo - 10 : hi + 10));
        t.data = lines[i] ?? ""; // characterData, not a child swap
      }
    }
    if (circle && o.dot && cross) {
      const dv = o.dot(v);
      const cp = dv === null ? Number.NaN : Number(cross.apply(dv));
      if (Number.isFinite(cp)) {
        set(circle, x ? { cx: mid, cy: cp } : { cx: cp, cy: mid });
        circle.removeAttribute("display");
      } else circle.setAttribute("display", "none");
    }
    g.removeAttribute("display");
  };

  let drawn: Cursor | null = null;
  const sync = (c: Cursor | null): void => {
    const mine = c !== null && c.field === o.field ? c : null;
    if (sameCursor(mine, drawn)) return; // a hover or selection change, or the same value again: nothing to move
    drawn = mine;
    draw(mine);
  };
  const offs: (() => void)[] = [store.subscribe((s) => sync(s.cursor))];
  offs.push(() => g.remove());
  sync(store.getState().cursor);

  let wrote: Cursor | null = null; // the store's cursor object this figure wrote
  /** Clear the store's cursor only while it holds the one this figure wrote: never an app's or another figure's. */
  const clear = (): void => {
    if (wrote !== null && store.getState().cursor === wrote) store.set({ cursor: null });
    wrote = null;
  };
  if (line && emit) {
    /** The value under the pointer along this axis, or null outside the axis' pixel range. */
    const valueAt = (p: number): number | null => {
      const [p0, p1] = along;
      if (!(p >= p0 && p <= p1)) return null;
      if (starts) {
        let best = 0;
        let gap = Number.POSITIVE_INFINITY;
        for (const [i, s] of starts.entries()) {
          const d = Math.abs(Number(line.scale.apply(s)) + (line.scale.bandwidth ?? 0) / 2 - p);
          if (d < gap) [best, gap] = [i, d];
        }
        const e = end(starts, best);
        const s = starts[best] ?? 0;
        return Number.isFinite(e) ? (s + e) / 2 : s;
      }
      const v = Number(line.scale.invert?.(p));
      return o.snap ? o.snap(v) : v;
    };
    const move = (e: Event): void => {
      const [mx, my] = pointer(e, svg);
      const v = valueAt(line.axis === "x" ? mx : my);
      if (v === null || !Number.isFinite(v)) clear();
      else {
        const had = store.getState().cursor;
        store.set({ cursor: { field: o.field, value: v } });
        const now = store.getState().cursor;
        // owned by identity, as a brush owns `selected`: the cursor this write made, or one this figure already
        // owned. An equal cursor set first elsewhere keeps its identity (the store drops a no-op), so it stays theirs
        wrote = now !== had || had === wrote ? now : null;
      }
    };
    const on = (type: string, fn: (e: Event) => void, capture: boolean): void => {
      svg.addEventListener(type, fn, { capture });
      offs.push(() => svg.removeEventListener(type, fn, { capture }));
    };
    on("pointermove", move, true);
    on("pointerdown", move, true); // A34: capture, before Plot's tip, which stops other pointerdowns
    // never capture a leave: pointerleave does not bubble, but a capture listener hears every mark's own leave, so
    // crossing a bar's edge inside one bin would write null and then the value again (nearestHover registers the same)
    on("pointerleave", clear, false);
    on("pointercancel", clear, false);
  }
  return () => {
    for (const off of offs) off();
    clear();
  };
}
