const SVG_NS = "http://www.w3.org/2000/svg";
/**
 * Dimming is one CSS rule keyed on a ROOT class, so a hover touches the root plus the marks whose state changed.
 * Axis decorations (`axisLogos` stamps `data-sdv-axis` beside an ESPN id) are not data marks: never dimmed.
 */
const CSS = ".sdv-focus [data-sdv-id]:not(.sdv-hl):not([data-sdv-axis]){opacity:var(--sdv-dim-opacity,0.2)}";
const EMPTY: ReadonlySet<string> = new Set<string>();

interface Lit {
  readonly index: Map<string, Set<Element>>;
  readonly mo: MutationObserver;
  ids: ReadonlySet<string> | null;
}
const roots = new WeakMap<Element, Lit>();

/**
 * Interaction needs a live DOM. Without one (Node / SSR) every `sdvplot/interact` function is a no-op, so a
 * server-rendered figure is byte-identical with or without a link.
 *
 * @example
 * ```ts
 * import { hasDom } from "@sportsdataverse/sdvplot/interact";
 *
 * // it depends on where this runs: a browser (or the jsdom that prerendered this page) has a DOM, Node has none
 * `this ran ${hasDom() ? "with a DOM: interact functions work" : "without a DOM: interact functions are no-ops"}`;
 * ```
 */
export function hasDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** A data mark's link id; `""` for a decoration (`data-sdv-axis`) or an empty stamp, which never index. */
const markId = (el: Element): string =>
  el.hasAttribute("data-sdv-axis") ? "" : (el.getAttribute("data-sdv-id") ?? "");

/** `node` and its stamped descendants (`nodeType`, not `instanceof`: a node may come from another realm). */
function stampedIn(node: Node): Element[] {
  if (node.nodeType !== 1) return [];
  const el = node as Element;
  const out = Array.from(el.querySelectorAll("[data-sdv-id]"));
  if (el.hasAttribute("data-sdv-id")) out.unshift(el);
  return out;
}
function add(index: Map<string, Set<Element>>, id: string, el: Element): void {
  const set = index.get(id);
  if (set) set.add(el);
  else index.set(id, new Set([el]));
}

/**
 * Fold DOM changes into the index: O(added + removed), never a rescan. Each node is judged by where it is NOW
 * (`root.contains`), so record order does not matter. A node added under an already-lit id is lit at once: Plot's
 * pointer redraws its layer on every move (`g.replaceWith`) and that writes no store value, so no `highlight` follows.
 */
function apply(root: Element, state: Lit, records: readonly MutationRecord[]): void {
  for (const r of records) {
    for (const el of Array.from(r.removedNodes).flatMap(stampedIn)) {
      const id = markId(el);
      const set = state.index.get(id);
      if (set === undefined || root.contains(el)) continue;
      set.delete(el);
      if (set.size === 0) state.index.delete(id);
    }
    for (const el of Array.from(r.addedNodes).flatMap(stampedIn)) {
      const id = markId(el);
      if (id === "" || !root.contains(el)) continue;
      add(state.index, id, el);
      if (state.ids?.has(id)) el.classList.add("sdv-hl");
    }
  }
}

// ponytail: one MutationObserver per root keeps the index in step with re-rendered layers; it lives as long as the
// root (the WeakMap and the observer registration both die with it), so there is nothing to disconnect.
function litOf(root: Element): Lit {
  const known = roots.get(root);
  if (known) return known;
  const index = new Map<string, Set<Element>>();
  for (const el of stampedIn(root)) {
    const id = markId(el);
    if (id !== "" && el !== root) add(index, id, el);
  }
  const doc = root.ownerDocument;
  const style =
    root.namespaceURI === SVG_NS ? doc.createElementNS(SVG_NS, "style") : doc.createElement("style");
  style.setAttribute("data-sdv-interact", "");
  style.textContent = CSS;
  root.append(style);
  const state: Lit = { index, mo: new MutationObserver((records) => apply(root, state, records)), ids: null };
  state.mo.observe(root, { childList: true, subtree: true });
  roots.set(root, state);
  return state;
}

/**
 * Emphasise the marks under `root` stamped (`data-sdv-id`) with one of `ids` and dim the rest; `null` clears and an
 * empty set dims everything. A class toggle, never a redraw: each call touches only the marks whose state changed,
 * plus the root's class, and one CSS rule (`--sdv-dim-opacity`, default 0.2) does the dimming. Marks Plot draws later
 * (a `Plot.pointer` layer) are indexed as they appear; axis logos (`data-sdv-axis`) are decorations and never dim.
 * Returns the ids that match no mark here (an id absent from this figure is not an error). No-op without a DOM.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { highlight } from "@sportsdataverse/sdvplot/interact";
 * import { linkIds } from "@sportsdataverse/sdvplot/plot";
 *
 * const rows = [
 *   { team: "KC", wins: 15, pf: 385 },
 *   { team: "BUF", wins: 13, pf: 525 },
 *   { team: "MIA", wins: 8, pf: 345 },
 * ];
 * const svg = Plot.plot({ marks: [Plot.dot(rows, { x: "wins", y: "pf", r: 6, render: linkIds(rows, "team") })] });
 * const missing = highlight(svg, new Set(["KC", "SEA"])); // ["SEA"]: no SEA dot here; BUF and MIA dim
 * svg;
 * ```
 */
export function highlight(root: Element, ids: ReadonlySet<string> | null): string[] {
  if (!hasDom()) return [];
  const state = litOf(root);
  apply(root, state, state.mo.takeRecords()); // changes the observer has not delivered yet
  const prev = state.ids ?? EMPTY;
  const next = ids ?? EMPTY;
  for (const id of prev) {
    if (next.has(id)) continue;
    for (const el of state.index.get(id) ?? []) el.classList.remove("sdv-hl");
  }
  const missing: string[] = [];
  for (const id of next) {
    const els = state.index.get(id);
    if (els === undefined) missing.push(id);
    else if (!prev.has(id)) for (const el of els) el.classList.add("sdv-hl");
  }
  root.classList.toggle("sdv-focus", ids !== null);
  state.ids = ids === null ? null : new Set(ids); // a copy: the caller may reuse its set
  return missing;
}
