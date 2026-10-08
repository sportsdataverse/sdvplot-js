import type { Table } from "../engine.js";
import { TableSpecError } from "../errors.js";
import { captureFocus, handleClick, handleHover, handleInput, handleKeydown } from "./controls.js";
import { pagerLabel, renderToolbar, tableRenderOptions } from "./interactive.js";
import { renderParts, tableHTML } from "./parts.js";

const edge = (button: Element | null, atEdge: boolean): void => {
  if (atEdge) button?.setAttribute("aria-disabled", "true");
  else button?.removeAttribute("aria-disabled");
};

/**
 * Progressive enhancement for markup produced by `renderHTML(table)`: one delegated click + input listener drive the
 * engine; each change re-renders ONLY the table block (`[data-sdv-body]`) and the pager, at most once per animation
 * frame (the engine state itself moves synchronously). Toolbar inputs are rebuilt only when a column is hidden or
 * shown; otherwise their values are synced from the engine state, so an external filter change shows in the box.
 * A focused control, or a focusable element inside a rendered cell, that the re-render replaced gets focus back
 * (shadow-root mounts included). Attaching does NOT reconcile the SSR markup against the engine state: render the
 * markup from the same table state you hydrate. The returned teardown is idempotent.
 */
export function hydrate<Row>(el: Element, table: Table<Row>): () => void {
  const body = el.querySelector("[data-sdv-body]");
  if (!body)
    throw new TableSpecError(
      "hydrate: no [data-sdv-body] in element; render it with renderHTML(table) first",
    );

  let hidden = table.state.hidden; // the engine replaces this array only when a column is hidden or shown
  const render = (): void => {
    cancel = undefined;
    const root = el.getRootNode() as Document | ShadowRoot;
    const restore = captureFocus(el);
    const p = renderParts(table.spec, table.rows, { css: "none", ...tableRenderOptions(table) });
    body.innerHTML = tableHTML(p);
    // M8: a hidden column's filter input leaves the toolbar (and comes back), as in renderHTML(table) and <SdvTable/>
    const toolbar = el.querySelector(".sdvt-toolbar");
    if (toolbar && table.state.hidden !== hidden) toolbar.outerHTML = renderToolbar(table, p.labels);
    hidden = table.state.hidden;
    const label = el.querySelector("[data-sdv-page-label]");
    if (label) label.textContent = pagerLabel(table);
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
  const onClick = (e: Event): void => handleClick(table, e.target);
  const onInput = (e: Event): void => handleInput(table, e.target);
  const onHover = (e: Event): void => handleHover(table, e.target); // J31 (A7)
  const onKeydown = (e: Event): void => handleKeydown(table, el, e as KeyboardEvent); // Task 10

  el.addEventListener("click", onClick);
  el.addEventListener("input", onInput);
  el.addEventListener("mouseover", onHover);
  el.addEventListener("mouseleave", onHover);
  el.addEventListener("keydown", onKeydown);
  // J31: a hover changes no state, and re-rendering on it would replace the row under the pointer
  const unsubscribe = table.subscribe((e) => {
    if (e.type !== "hover") schedule();
  });
  return () => {
    unsubscribe();
    cancel?.();
    cancel = undefined;
    el.removeEventListener("click", onClick);
    el.removeEventListener("input", onInput);
    el.removeEventListener("mouseover", onHover);
    el.removeEventListener("mouseleave", onHover);
    el.removeEventListener("keydown", onKeydown);
  };
}
