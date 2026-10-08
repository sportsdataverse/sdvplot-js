import { warn } from "../errors.js";
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
export interface LinkTargets<Row, Datum = unknown> {
  /** A rendered figure whose marks carry `data-sdv-id` (`linkIds`, or a d3 chart's own stamps). */
  plot?: Element;
  /**
   * How the figure writes `hover`. `true` (the default): the stamped mark under the pointer (`mouseover`). `false`: it
   * writes nothing, for a figure another writer hovers. `{ id }`: the datum Plot's own `tip`/`pointer` picks, the
   * nearest within its `maxRadius`, published as the figure's `value` with an `input` event; `id` maps it to a link id
   * (`null` clears). Pass `plot` as `Plot.plot` returned it: with a caption or legend that is a `<figure>`, and only the
   * figure hears `input`.
   */
  hover?: boolean | { readonly id: (datum: Datum) => unknown };
  /** A `createTable` engine: `useTable().table`, or the one passed to `hydrate`. */
  table?: LinkableTable<Row>;
}

const first = (ids: ReadonlySet<string>): string | null => {
  for (const id of ids) return id;
  return null;
};
/** A data mark's element under the event: its stamp, never an axis decoration's (`data-sdv-axis`, A39). */
const MARK = "[data-sdv-id]:not([data-sdv-axis])";

/**
 * Wire a figure and/or a table to a selection store (J31). Figure: pointer hover → `hover` (see
 * {@link LinkTargets.hover}); every store change → `highlight(plot, focusIds(state))`. Table: row hover / click →
 * `hover` / `selected`; every store change → `setSelection(selected)`, `setExternalFilter(predicate)` and
 * `setHover` with the first hover id. Loop-free: the store and the engine drop no-op updates, and the events a table
 * emits while the store is being applied to it are not written back (so a two-id hover is never narrowed to the one id
 * a table holds). One figure or one table per call; link several by calling again with the same store. Returns a
 * teardown. Inert without a DOM, so server-rendered markup never changes.
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
 * linkSelection(store, { plot: svg });
 * linkSelection(store, { table });
 * table.setSelection(new Set(["BUF"])); // what a click on Buffalo's row calls: the store and the figure follow
 * svg; // Buffalo's dot lit, the rest dimmed
 * ```
 */
export function linkSelection<Row, Datum = unknown>(
  store: SelectionStore<Row>,
  targets: LinkTargets<Row, Datum>,
): () => void {
  if (!hasDom()) return () => {};
  const { plot, table, hover = true } = targets;
  const offs: (() => void)[] = [];
  let syncing = false; // A29: the table's own events while the store is applied to it are echoes, not user input
  const sync = (s: SelectionState<Row>): void => {
    if (plot) {
      const focus = focusIds(s);
      const missing = highlight(plot, focus);
      if (focus !== null && focus.size > 0 && missing.length === focus.size) {
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
  if (plot && hover === true) {
    on(plot, "mouseover", (e) => {
      const t = e.target as Node | null;
      const mark = t?.nodeType === 1 ? (t as Element).closest(MARK) : null;
      store.set({ hover: mark ? [mark.getAttribute("data-sdv-id") ?? ""] : [] });
    });
    on(plot, "mouseleave", () => store.set({ hover: [] }));
  } else if (plot && typeof hover === "object") {
    // Plot sets `value` on the element it dispatches `input` from (the svg, or the <figure> wrapping it)
    on(plot, "input", (e) => {
      const v = (e.target as { value?: unknown } | null)?.value;
      store.set({ hover: v === null || v === undefined ? [] : [toId(hover.id(v as Datum))] });
    });
  }
  if (table) {
    offs.push(
      table.subscribe((e) => {
        if (syncing) return;
        if (e.type === "hover") store.set({ hover: e.id === null ? [] : [e.id] });
        else if (e.type === "select") store.set({ selected: e.ids });
      }),
    );
  }
  offs.push(store.subscribe(sync));
  sync(store.getState());
  return () => {
    for (const off of offs) off();
  };
}
