import type { Table } from "../engine.js";
import { TableSpecError } from "../errors.js";
import {
  applyHover,
  captureFocus,
  handleClick,
  handleHover,
  handleInput,
  handleKeydown,
} from "./controls.js";
import { pagerLabel, renderToolbar, tableRenderOptions } from "./interactive.js";
import { renderParts, tableHTML } from "./parts.js";

/** I2: each element's live binding, so hydrating it again replaces the old one (see `replace`). */
const live = new WeakMap<Element, () => void>();
/** Bodies a teardown left behind the engine (it dropped a render still owed); the next hydrate of one redraws it. */
// ponytail: exists for React StrictMode's double effect (mount, cleanup, mount); weak, so it never holds a body alive
const behind = new WeakSet<Element>();

const edge = (button: Element | null, atEdge: boolean): void => {
  if (atEdge) button?.setAttribute("aria-disabled", "true");
  else button?.removeAttribute("aria-disabled");
};

/**
 * Progressive enhancement for markup produced by `renderHTML(table)`: one delegated click + input listener drive the
 * engine; each change re-renders ONLY the table block (`[data-sdv-body]`) and the pager, once, on the next animation
 * frame, however many changes land in it (the engine state itself moves synchronously). One exception: a click,
 * pointer move or key on the table while a change to its rows (a sort, filter, page turn or `setRows`) waits for that
 * frame draws it at once, so the event never reads an old row as the one now at its index; a click or key on a row
 * this replaced acts on nothing, and Enter or Space on it is consumed, so the page does not scroll. A change that keeps
 * the rows (a selection, the cursor, a keyed row re-sent as a new object) waits for its frame. Toolbar inputs are
 * rebuilt only when a column is hidden or shown; otherwise their values are synced from the engine state, so an
 * external filter change shows in the box. A row hover (the pointer's, or a linked figure's through `linkSelection`)
 * re-renders nothing: the row gets the `sdvt-hover` class, which survives the next re-render; a hover the engine
 * already holds (`getHover`) shows on attach. A focused control, or a focusable element inside a rendered cell, that
 * the re-render replaced gets focus back (shadow-root mounts included). Attaching does NOT reconcile the SSR markup
 * against the engine state: render the markup from the same table state you hydrate. Hydrating an element again
 * replaces its previous binding (HMR, client-side navigation, an effect without cleanup) after drawing any change that
 * binding still owed, so every control still acts once. The returned teardown is idempotent and drops a render still
 * owed; hydrating that element again redraws it (on the next frame, or at once for an event that comes first), so React
 * StrictMode's mount, cleanup, mount leaves no stale rows. Until the teardown runs, the table's subscriber keeps `el`
 * alive as long as the table lives.
 */
export function hydrate<Row>(el: Element, table: Table<Row>): () => void {
  const body = el.querySelector("[data-sdv-body]");
  if (!body)
    throw new TableSpecError(
      "hydrate: no [data-sdv-body] in element; render it with renderHTML(table) first",
    );
  live.get(el)?.();

  let hidden = table.state.hidden; // the engine replaces this array only when a column is hidden or shown
  // the rows the body shows: the SSR markup's until the first render; unknown (null) on a body a teardown left behind,
  // so an event before its redraw frame redraws first, even when the engine now holds no row
  let drawn: readonly Row[] | null = behind.has(body) ? null : table.rows;
  const render = (): void => {
    cancel = undefined;
    const root = el.getRootNode() as Document | ShadowRoot;
    const restore = captureFocus(el);
    const p = renderParts(table.spec, table.rows, { css: "none", ...tableRenderOptions(table) });
    body.innerHTML = tableHTML(p);
    drawn = table.rows; // after the write: a render that throws leaves the rows the body still shows on record
    // M8: a hidden column's filter input leaves the toolbar (and comes back), as in renderHTML(table) and <SdvTable/>
    const toolbar = el.querySelector(".sdvt-toolbar");
    if (toolbar && table.state.hidden !== hidden) toolbar.outerHTML = renderToolbar(table, p.labels);
    hidden = table.state.hidden;
    const label = el.querySelector("[data-sdv-page-label]");
    const page = pagerLabel(table);
    if (label && label.textContent !== page) label.textContent = page; // M6: an unchanged live region is not re-announced
    edge(el.querySelector('[data-sdv-page="prev"]'), table.state.page === 0);
    edge(el.querySelector('[data-sdv-page="next"]'), table.state.page >= table.pageCount - 1);
    // I1: an external setFilter / setGlobalFilter / clear moves the engine state, not the box; a focused input wins
    for (const input of Array.from(
      el.querySelectorAll<HTMLInputElement>("[data-sdv-filter],[data-sdv-global-filter]"),
    )) {
      if (input === root.activeElement) continue;
      const key = input.getAttribute("data-sdv-filter");
      const f = key === null ? table.state.globalFilter : table.state.filters[key];
      const want = typeof f === "string" ? f : "";
      if (input.value !== want) input.value = want;
    }
    applyHover(el, table, table.getHover()); // the body was rebuilt: a linked figure's hover survives it
    restore();
  };
  // M6: one render per animation frame however many changes land in it (typing in an unpaged 1000-row table
  // re-rendered ~660 KB per keystroke); a timer where there is no requestAnimationFrame
  let cancel: (() => void) | undefined;
  const schedule = (): void => {
    if (cancel) return;
    if (typeof requestAnimationFrame === "function") {
      const id = requestAnimationFrame(render);
      cancel = () => cancelAnimationFrame(id);
    } else {
      const id = setTimeout(render, 0);
      cancel = () => clearTimeout(id);
    }
  };
  // a row event while a render that changes the rows is pending would read the old body's data-row against the new
  // rows (LV's row as BUF): render first, so the target is a current row, or a replaced one that names no row. A
  // pending render that keeps the rows (a selection, the cursor) leaves data-row right, and the target in place.
  // A keyed row re-sent as a new object (a live feed) keeps its id, so the old body's data-row still names it: it moved
  // only when its object AND its id differ. Never ids saved at render: without a rowKey those are positions, so the
  // old row 3 would read as whatever is at index 3 now; the engine's id of an old object is "" (gone) or its new index
  const same = (r: Row, i: number): boolean => {
    const was = drawn?.[i] as Row; // the lengths match
    return r === was || table.rowId(r) === table.rowId(was);
  };
  const flush = (): boolean => {
    const rows = table.rows;
    if (!cancel || (rows.length === drawn?.length && rows.every(same))) return false;
    cancel();
    render();
    return true;
  };
  const onClick = (e: Event): void => {
    flush();
    handleClick(table, e.target);
  };
  const onInput = (e: Event): void => handleInput(table, e.target);
  const onHover = (e: Event): void => {
    flush();
    handleHover(table, e.target); // J31 (A7)
  };
  const onKeydown = (e: Event): void => {
    const k = e as KeyboardEvent;
    // the flush replaced the focused body row: Enter and Space act on nothing, and Space must not scroll the page. A
    // row only: a sort button rebuilt under focus gets it back, and the browser's activation of it still sorts
    if (
      flush() &&
      (k.key === " " || k.key === "Enter") &&
      (k.target as Element).matches(".sdvt-row[data-row]")
    )
      k.preventDefault();
    handleKeydown(table, el, k); // Task 10
  };

  el.addEventListener("click", onClick);
  el.addEventListener("input", onInput);
  el.addEventListener("mouseover", onHover);
  el.addEventListener("mouseleave", onHover);
  el.addEventListener("keydown", onKeydown);
  // J31: a hover changes no state, and re-rendering on it would replace the row under the pointer: a class toggle
  const unsubscribe = table.subscribe((e) => {
    if (e.type !== "hover") schedule();
    // a pending render means the DOM still shows the old rows, which data-row would misread: render applies it
    else if (cancel === undefined) applyHover(el, table, e.id);
  });
  applyHover(el, table, table.getHover()); // a hover set before this attached (a linked figure's) shows now
  if (behind.delete(body)) schedule(); // a teardown dropped a render this body still owes (StrictMode's cleanup)
  const teardown = (): void => {
    if (live.get(el) === replace) live.delete(el);
    unsubscribe();
    if (cancel) {
      cancel();
      behind.add(body); // the body stays behind the engine until the next hydrate of it redraws
    }
    cancel = undefined;
    el.removeEventListener("click", onClick);
    el.removeEventListener("input", onInput);
    el.removeEventListener("mouseover", onHover);
    el.removeEventListener("mouseleave", onHover);
    el.removeEventListener("keydown", onKeydown);
  };
  // M3: hydrating `el` again first draws a change this binding still owes, so the next one starts from a current body
  // (its `drawn` is the engine's rows); a plain teardown drops it, since the element may no longer be ours to write,
  // and leaves the body `behind` for whichever hydrate comes next
  const replace = (): void => {
    if (cancel) {
      cancel();
      render();
    }
    teardown();
  };
  live.set(el, replace);
  return teardown;
}
