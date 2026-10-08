import { type Table, nextSortDir } from "../engine.js";

/** J31: the engine id of the body row an event landed in; null for a header, toolbar, pager, group row, or outside the table. */
export function rowIdAt<Row>(table: Table<Row>, target: EventTarget | null): string | null {
  // scoped to the body block: a host page or outer table with its own tr[data-row] is never read as one of ours
  const tr = target instanceof Element ? target.closest("[data-sdv-body] tr.sdvt-row[data-row]") : null;
  const row = tr === null ? undefined : table.rows[Number(tr.getAttribute("data-row"))];
  const id = row === undefined ? "" : table.rowId(row);
  return id === "" ? null : id;
}

/** A click anywhere inside the table wrapper — shared by hydrate and `<SdvTable/>`. */
export function handleClick<Row>(table: Table<Row>, target: EventTarget | null): void {
  const el =
    target instanceof Element ? target.closest<HTMLElement>("[data-sdv-sort],[data-sdv-page]") : null;
  if (!el) {
    // J31: a click on a body row toggles its id in the selection
    const id = rowIdAt(table, target);
    if (id === null) return;
    const next = new Set(table.getSelection());
    if (!next.delete(id)) next.add(id);
    table.setSelection(next);
    return;
  }
  if (el.getAttribute("aria-disabled") === "true") return; // M1: an edge pager button keeps focus and does nothing
  const sortCol = el.getAttribute("data-sdv-sort");
  const page = el.getAttribute("data-sdv-page");
  if (sortCol !== null) table.setSort(sortCol, nextSortDir(table.state.sort, sortCol));
  else if (page === "prev") table.setPage(table.state.page - 1);
  else if (page === "next") table.setPage(table.state.page + 1);
}

/** An `input` event anywhere inside the wrapper. */
export function handleInput<Row>(table: Table<Row>, target: EventTarget | null): void {
  if (!(target instanceof HTMLInputElement)) return;
  const col = target.getAttribute("data-sdv-filter");
  if (col !== null) table.setFilter(col, target.value === "" ? null : target.value);
  else if (target.hasAttribute("data-sdv-global-filter")) table.setGlobalFilter(target.value);
}

/** J31: `mouseover` / `mouseleave` inside the wrapper → the engine's hover event (null off a body row). */
export function handleHover<Row>(table: Table<Row>, target: EventTarget | null): void {
  table.setHover(rowIdAt(table, target));
}

// M5: the attributes that name a control; a control rebuilt under focus gets focus back by name
const CONTROLS = ["data-sdv-sort", "data-sdv-filter", "data-sdv-global-filter", "data-sdv-page"] as const;
const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";

/**
 * Remembers what has focus inside `el` by names a re-render keeps: a control by its `data-sdv-*` attribute (and an
 * input's caret), a focusable element inside a rendered cell by row, column key and its index among that cell's
 * focusables. Call it before a re-render; the returned function, called after it, moves focus to the rebuilt element
 * when the re-render replaced the focused one (shadow-root mounts included), and does nothing otherwise. Shared by
 * hydrate and `<SdvTable/>`.
 */
export function captureFocus(el: Element): () => void {
  const root = el.getRootNode() as Document | ShadowRoot;
  const focused = root.activeElement ?? el.ownerDocument.activeElement;
  if (focused === null || !el.contains(focused)) return () => {};
  const name = CONTROLS.find((a) => focused.hasAttribute(a));
  const value = name === undefined ? null : focused.getAttribute(name);
  const caret =
    focused instanceof HTMLInputElement
      ? { start: focused.selectionStart, end: focused.selectionEnd }
      : undefined;
  const td = name === undefined ? focused.closest("[data-sdv-body] tr[data-row] td[data-col]") : null;
  const cellAt = td
    ? {
        row: td.parentElement?.getAttribute("data-row"),
        col: td.getAttribute("data-col"),
        n: Array.from(td.querySelectorAll(FOCUSABLE)).indexOf(focused),
      }
    : undefined;
  return () => {
    if (el.contains(focused)) return;
    if (name !== undefined) {
      const next = Array.from(el.querySelectorAll<HTMLElement>(`[${name}]`)).find(
        (n) => n.getAttribute(name) === value,
      );
      next?.focus();
      if (next instanceof HTMLInputElement && caret?.start != null && caret.end != null)
        next.setSelectionRange(caret.start, caret.end);
    } else if (cellAt && cellAt.n >= 0) {
      const tds = Array.from(el.querySelectorAll("[data-sdv-body] tr[data-row]"))
        .find((r) => r.getAttribute("data-row") === cellAt.row)
        ?.querySelectorAll("td[data-col]");
      const cell = Array.from(tds ?? []).find((c) => c.getAttribute("data-col") === cellAt.col);
      cell?.querySelectorAll<HTMLElement>(FOCUSABLE)[cellAt.n]?.focus();
    }
  };
}
