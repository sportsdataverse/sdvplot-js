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
