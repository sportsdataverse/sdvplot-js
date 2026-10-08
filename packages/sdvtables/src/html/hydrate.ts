import type { Table } from "../engine.js";
import { TableSpecError } from "../errors.js";
import { handleClick, handleHover, handleInput } from "./controls.js";
import { pagerLabel, renderToolbar, tableRenderOptions } from "./interactive.js";
import { renderParts, tableHTML } from "./parts.js";

// M5: the attributes that name a control; a control rebuilt under focus gets focus back by name
const CONTROLS = ["data-sdv-sort", "data-sdv-filter", "data-sdv-global-filter", "data-sdv-page"] as const;

const edge = (button: Element | null, atEdge: boolean): void => {
  if (atEdge) button?.setAttribute("aria-disabled", "true");
  else button?.removeAttribute("aria-disabled");
};

/**
 * Progressive enhancement for markup produced by `renderHTML(table)`: one delegated click + input listener drive the
 * engine; each change re-renders ONLY the table block (`[data-sdv-body]`) and the pager, at most once per animation
 * frame (the engine state itself moves synchronously). Toolbar inputs are re-rendered only when a column is hidden or
 * shown, and a control the re-render replaced while focused gets focus back. Returns a teardown function.
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
    const focused = el.ownerDocument.activeElement;
    const name = focused && el.contains(focused) ? CONTROLS.find((a) => focused.hasAttribute(a)) : undefined;
    const value = name === undefined ? null : focused?.getAttribute(name);
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
    if (name !== undefined && focused && !el.contains(focused))
      Array.from(el.querySelectorAll<HTMLElement>(`[${name}]`))
        .find((n) => n.getAttribute(name) === value)
        ?.focus();
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

  el.addEventListener("click", onClick);
  el.addEventListener("input", onInput);
  el.addEventListener("mouseover", onHover);
  el.addEventListener("mouseleave", onHover);
  // J31: a hover changes no state, and re-rendering on it would replace the row under the pointer
  const unsubscribe = table.subscribe((e) => {
    if (e.type !== "hover") schedule();
  });
  return () => {
    unsubscribe();
    cancel?.();
    el.removeEventListener("click", onClick);
    el.removeEventListener("input", onInput);
    el.removeEventListener("mouseover", onHover);
    el.removeEventListener("mouseleave", onHover);
  };
}
