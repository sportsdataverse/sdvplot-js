import { InputError, warn } from "../errors.js";
import { type RowFilter, type SelectionState, type SelectionStore, focusIds, toId } from "../selection.js";
import { hasDom, highlight } from "./highlight.js";

/** What an sdvtables engine emits on `subscribe` (structurally its `TableEvent`). */
export type LinkEvent =
  | { readonly type: "change" }
  | { readonly type: "hover"; readonly id: string | null }
  | { readonly type: "select"; readonly ids: ReadonlySet<string> };
/** The slice of an sdvtables `Table` that linking needs. Structural, so sdvplot never depends on sdvtables. */
export interface LinkableTable<Row> {
  /** Filter the table's rows by a row test (the store's brush region); `null` clears it. */
  setExternalFilter(filter: RowFilter<Row> | null): void;
  /** Select rows by id; the table renders them selected. */
  setSelection(ids: ReadonlySet<string>): void;
  /** Light one row by id (the store's first hover id); `null` clears it. A table holds one hover id. */
  setHover(id: string | null): void;
  /** Row hover and click events; returns the unsubscribe function. */
  subscribe(fn: (event: LinkEvent) => void): () => void;
}
/** What {@link linkSelection} wires to a store: one figure and/or one table. */
export interface LinkSelectionOptions<Row, Datum = unknown> {
  /**
   * The figure whose marks carry `data-sdv-id`: what `Plot.plot` returns (stamped by `linkIds`), or a d3-drawn `<svg>`
   * with its own stamps.
   */
  figure?: Element;
  /**
   * How the figure writes `hover`. `true` (the default): the stamped mark under the pointer (`mouseover`). `false`: it
   * writes nothing, for a figure another writer hovers. `{ id }`: the datum Plot's own `tip`/`pointer` picks, the
   * nearest within its `maxRadius`, published as the figure's `value` with an `input` event; `id` maps it to a link id
   * (`null` clears). Pass `figure` as `Plot.plot` returned it: with a caption or legend that is a `<figure>`, and only the
   * figure hears `input`. Anything else throws `InputError`, in Node too.
   */
  hover?: boolean | { readonly id: (datum: Datum) => unknown };
  /** A `createTable` engine: `useTable().table`, or the one passed to `hydrate`. */
  table?: LinkableTable<Row>;
  /**
   * `"toggle"`: each stamped mark of `figure` becomes a checkbox (`role`, `tabindex="0"`, `aria-checked` kept in step
   * with the store), and a click, Enter or Space toggles its id in `selected`. Each checkbox keeps the mark's own
   * accessible name: name the marks through Plot's `ariaLabel` channel (`ariaLabel: "matchup"`, an `aria-label`) or its
   * `title` channel (a `<title>`); a mark with neither is named by its link id until teardown. Throws `InputError` when
   * a mark sits in an `<a href>`: a checkbox inside a link is nested interactive content with two tab stops.
   */
  select?: "toggle";
}

const first = (ids: ReadonlySet<string>): string | null => {
  for (const id of ids) return id;
  return null;
};
/**
 * A data mark's element under the event: its stamp, never an axis decoration's (`data-sdv-axis`, A39), nor an empty
 * stamp (`toId`'s missing id), which names no row to hover or toggle.
 */
const MARK = '[data-sdv-id]:not([data-sdv-id=""]):not([data-sdv-axis])';
/** The stamped mark an event in `figure` landed in; `closest` alone climbs past `figure` to a stamped ancestor. */
const markAt = (figure: Element, e: Event): Element | null => {
  const t = e.target as Node | null;
  const mark = t?.nodeType === 1 ? (t as Element).closest(MARK) : null;
  return mark && figure.contains(mark) ? mark : null;
};
/** Figures already warned about a join-key mismatch: once per figure, not once per hovered id. */
const warned = new WeakSet<Element>();
/** Live links per figure: a teardown un-dims its figure only when no other link on it still follows the store. */
const links = new WeakMap<Element, number>();
/** What `select: "toggle"` sets on a mark, and its teardown gives back. */
const TOGGLE_ATTRS = ["role", "tabindex", "aria-checked", "aria-label"] as const;

/**
 * Wire a figure and/or a table to a selection store (J31). Figure: pointer hover → `hover` (see
 * {@link LinkSelectionOptions.hover}); every store change → `highlight(figure, focusIds(state))`. Table: row hover /
 * click → `hover` / `selected`; every store change → `setSelection(selected)`, `setExternalFilter(predicate)` and
 * `setHover` with the first hover id. Loop-free: the store and the engine drop no-op updates, and the events a table
 * emits while the store is being applied to it are not written back (so a two-id hover is never narrowed to the one id
 * a table holds). One figure or one table per call; link several by calling again with the same store. The store
 * comes first because the call takes a figure, a table or both. Returns a teardown FUNCTION, not a handle: teardown is
 * all a link has, so `useEffect(() => linkSelection(store, o), deps)` is one line (`brushFilter`, `nearestHover` and
 * `tooltip`, which have more to do, return a handle with `destroy()`). The teardown clears `hover` when the store still
 * holds the id this link last wrote (as `nearestHover`'s `destroy` does): a figure redrawn under the pointer leaves no
 * stale hover dimming the others. It then restores the view it changed, so a figure or table unlinked and kept on the
 * page shows no store state: the figure un-dims (once the last link on it goes), its toggled marks get their own
 * attributes back, and the table drops the brush filter and the hover it showed. It never clears store state another
 * writer owns: a brush's region and a selection stay in the store for the views still linked. To replace a figure,
 * tear its link down before linking the new one, which otherwise reads the old figure's hover. Inert without a DOM,
 * so server-rendered markup never changes. With `select: "toggle"`, the figure's marks are keyboard-reachable
 * checkboxes over `selected` ({@link LinkSelectionOptions.select}).
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { linkSelection } from "@sportsdataverse/sdvplot/interact";
 * import { linkIds } from "@sportsdataverse/sdvplot/plot";
 * import { createTable, defineTable } from "@sportsdataverse/sdvtables";
 *
 * const rows = [
 *   { team: "KC", wins: 15, net_epa: 0.063 },
 *   { team: "BUF", wins: 13, net_epa: 0.19 },
 *   { team: "MIA", wins: 8, net_epa: -0.019 },
 * ];
 * type Row = (typeof rows)[number];
 * const svg = Plot.plot({ marks: [Plot.dot(rows, { x: "wins", y: "net_epa", r: 6, render: linkIds(rows, "team") })] });
 * const spec = defineTable<Row>().columns((c) => [c.text("team"), c.int("wins")]).rowKey("team").build();
 * const table = createTable(spec, rows); // the engine a hydrated table or <SdvTable table/> renders
 * const store = createSelection<Row>();
 * linkSelection(store, { figure: svg });
 * linkSelection(store, { table });
 * table.setSelection(new Set(["BUF"])); // what a click on Buffalo's row calls: the store and the figure follow
 * svg; // Buffalo's dot lit, the rest dimmed
 * ```
 *
 * @example Games as checkboxes: click a cell, or Tab to it and press Enter or Space
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { createSelection } from "@sportsdataverse/sdvplot";
 * import { linkSelection } from "@sportsdataverse/sdvplot/interact";
 * import { linkIds } from "@sportsdataverse/sdvplot/plot";
 *
 * // five of Brooklyn's 2025-26 games
 * const games = [
 *   { game_id: "0022500130", game_date: "2025-10-29", matchup: "BKN vs. ATL", wl: "L" },
 *   { game_id: "0022500149", game_date: "2025-11-02", matchup: "BKN vs. PHI", wl: "L" },
 *   { game_id: "0022500156", game_date: "2025-11-03", matchup: "BKN vs. MIN", wl: "L" },
 *   { game_id: "0022500173", game_date: "2025-11-05", matchup: "BKN @ IND", wl: "W" },
 *   { game_id: "0022500031", game_date: "2025-11-07", matchup: "BKN vs. DET", wl: "L" },
 * ];
 * const svg = Plot.plot({
 *   height: 60,
 *   x: { type: "band" },
 *   marks: [
 *     Plot.cell(games, { x: "game_date", fill: "wl", ariaLabel: "matchup", render: linkIds(games, "game_id") }),
 *   ],
 * });
 * const store = createSelection<(typeof games)[number]>();
 * linkSelection(store, { figure: svg, select: "toggle" }); // each cell: role="checkbox", tabindex="0", aria-checked
 * svg.querySelector('[data-sdv-id="0022500173"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
 * [...store.getState().selected]; // ["0022500173"]: the win at Indiana
 * ```
 */
export function linkSelection<Row, Datum = unknown>(
  store: SelectionStore<Row>,
  o: LinkSelectionOptions<Row, Datum>,
): () => void {
  const toggled = toggleMarks(o);
  const { figure, table, hover = true } = o;
  if (typeof hover !== "boolean" && typeof (hover as { id?: unknown } | null)?.id !== "function")
    throw new InputError("linkSelection: hover is true, false or { id: (datum) => link id }");
  if (!hasDom()) return () => {};
  if (figure) links.set(figure, (links.get(figure) ?? 0) + 1);
  const offs: (() => void)[] = [];
  let wrote: string | null = null; // the hover id this link last wrote, which its teardown clears if still current
  const writeHover = (id: string | null): void => {
    wrote = id;
    store.set({ hover: id === null ? [] : [id] });
  };
  let syncing = false; // A29: the table's own events while the store is applied to it are echoes, not user input
  const sync = (s: SelectionState<Row>): void => {
    if (figure) {
      const focus = focusIds(s);
      const missing = highlight(figure, focus);
      if (focus !== null && focus.size > 0 && missing.length === focus.size && !warned.has(figure)) {
        warned.add(figure);
        const shown = missing.slice(0, 5).join(", ");
        warn(
          `link:missing:${shown}`,
          `none of the linked ids (${shown}${missing.length > 5 ? ", …" : ""}) is drawn in this figure; the marks' id channel and the table's rowKey must hold the same values`,
        );
      }
    }
    if (table) {
      syncing = true;
      try {
        table.setSelection(s.selected);
        table.setExternalFilter(s.predicate);
        table.setHover(first(s.hover));
      } finally {
        syncing = false;
      }
    }
  };
  const on = (el: Element, type: string, fn: (e: Event) => void): void => {
    el.addEventListener(type, fn);
    offs.push(() => el.removeEventListener(type, fn));
  };
  if (figure && hover === true) {
    on(figure, "mouseover", (e) => {
      const mark = markAt(figure, e);
      writeHover(mark ? (mark.getAttribute("data-sdv-id") ?? "") : null);
    });
    on(figure, "mouseleave", () => writeHover(null));
  } else if (figure && typeof hover === "object") {
    // Plot sets `value` on the element it dispatches `input` from (the svg, or the <figure> wrapping it)
    on(figure, "input", (e) => {
      const v = (e.target as { value?: unknown } | null)?.value;
      writeHover(v === null || v === undefined ? null : toId(hover.id(v as Datum)));
    });
  }
  if (table) {
    offs.push(
      table.subscribe((e) => {
        if (syncing) return;
        if (e.type === "hover") writeHover(e.id);
        else if (e.type === "select") store.set({ selected: e.ids });
      }),
    );
  }
  if (figure && toggled.length > 0) offs.push(toggles(figure, store, toggled));
  offs.push(store.subscribe(sync));
  sync(store.getState());
  let live = true;
  return () => {
    if (!live) return; // a second teardown writes and restores nothing
    live = false;
    const h = store.getState().hover;
    // before the unsubscribe: this figure, and its table, still follow the store and un-dim too
    if (wrote !== null && h.size === 1 && h.has(wrote)) store.set({ hover: [] });
    wrote = null;
    for (const off of offs) off();
    // Unlink and keep: restore the view this link changed, never the store, which the views still linked show. Done
    // after the unsubscribe, so the table's own events now are not written back.
    if (figure) {
      const n = (links.get(figure) ?? 1) - 1;
      if (n > 0) links.set(figure, n);
      else {
        links.delete(figure);
        highlight(figure, null);
      }
    }
    if (table) {
      const s = store.getState();
      if (s.predicate !== null) table.setExternalFilter(null);
      if (s.hover.size > 0) table.setHover(null);
    }
  };
}

/** `select: "toggle"`'s marks, checked before the DOM test so a bad call throws in Node too (A36, A38). */
function toggleMarks(t: { readonly figure?: Element; readonly select?: "toggle" }): Element[] {
  if (t.select === undefined) return [];
  if (t.select !== "toggle")
    throw new InputError(`linkSelection: select is "toggle", not ${JSON.stringify(t.select)}`);
  if (t.figure === undefined)
    throw new InputError('linkSelection: select "toggle" needs the figure whose marks it toggles');
  const marks = Array.from(t.figure.querySelectorAll(MARK));
  // closest() matches the element itself: linkIds stamps an <a href> (A38), which a parent-only lookup would miss
  const linked = marks.find((m) => m.closest("a[href]") !== null);
  if (linked)
    throw new InputError(
      `linkSelection: select "toggle" would put a checkbox inside a link (the mark "${linked.getAttribute("data-sdv-id")}" is in an <a href>); drop one`,
    );
  return marks;
}

/**
 * Marks as checkboxes over `selected` (blazing-the-nets main, lib/charts/gameStrip.ts:75-110): a click, Enter or Space
 * toggles a mark's id; `aria-checked` follows the store, set only on the marks whose membership changed.
 */
function toggles<Row>(figure: Element, store: SelectionStore<Row>, marks: readonly Element[]): () => void {
  const byId = new Map<string, Element[]>();
  let shown = store.getState().selected;
  const own = marks.map((m) => TOGGLE_ATTRS.map((a) => m.getAttribute(a))); // a d3 mark may have had its own
  for (const m of marks) {
    const id = m.getAttribute("data-sdv-id") ?? "";
    const same = byId.get(id);
    if (same) same.push(m);
    else byId.set(id, [m]);
    m.setAttribute("role", "checkbox");
    m.setAttribute("tabindex", "0");
    m.setAttribute("aria-checked", String(shown.has(id)));
    // a checkbox needs a name: the mark's own (Plot's ariaLabel channel writes aria-label, its title channel a
    // <title> child), else its link id
    if (!m.hasAttribute("aria-label") && !m.hasAttribute("aria-labelledby") && !m.querySelector(":scope > title"))
      m.setAttribute("aria-label", id);
  }
  const flip = (e: Event): void => {
    const id = markAt(figure, e)?.getAttribute("data-sdv-id");
    if (!id) return;
    if (e.type === "keydown") {
      const key = (e as KeyboardEvent).key;
      if (key !== "Enter" && key !== " ") return;
      e.preventDefault(); // Space would scroll the page
    }
    const next = new Set(store.getState().selected);
    if (!next.delete(id)) next.add(id);
    store.set({ selected: next });
  };
  const check = (ids: Iterable<string>, unless: ReadonlySet<string>, value: string): void => {
    for (const id of ids)
      if (!unless.has(id)) for (const m of byId.get(id) ?? []) m.setAttribute("aria-checked", value);
  };
  const off = store.subscribe((s) => {
    if (s.selected === shown) return;
    check(shown, s.selected, "false");
    check(s.selected, shown, "true");
    shown = s.selected;
  });
  figure.addEventListener("click", flip);
  figure.addEventListener("keydown", flip);
  return () => {
    off();
    figure.removeEventListener("click", flip);
    figure.removeEventListener("keydown", flip);
    for (const [i, m] of marks.entries())
      for (const [k, a] of TOGGLE_ATTRS.entries()) {
        const v = own[i]?.[k] ?? null;
        if (v === null) m.removeAttribute(a);
        else m.setAttribute(a, v);
      }
  };
}
