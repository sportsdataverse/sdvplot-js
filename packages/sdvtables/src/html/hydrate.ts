import type { Table } from "../engine.js";
import { TableSpecError } from "../errors.js";
import { handleClick, handleHover, handleInput } from "./controls.js";
import { pagerLabel, tableRenderOptions } from "./interactive.js";
import { renderParts, tableHTML } from "./parts.js";

/**
 * Progressive enhancement for markup produced by `renderHTML(table)`: one delegated click + input listener drive the
 * engine; each change re-renders ONLY the table block (`[data-sdv-body]`) and the pager. Toolbar inputs are never
 * re-rendered. Returns a teardown function.
 */
export function hydrate<Row>(el: Element, table: Table<Row>): () => void {
  const body = el.querySelector("[data-sdv-body]");
  if (!body)
    throw new TableSpecError(
      "hydrate: no [data-sdv-body] in element; render it with renderHTML(table) first",
    );

  const render = (): void => {
    const p = renderParts(table.spec, table.rows, { css: "none", ...tableRenderOptions(table) });
    body.innerHTML = tableHTML(p);
    const label = el.querySelector("[data-sdv-page-label]");
    if (label) label.textContent = pagerLabel(table);
    const prev = el.querySelector<HTMLButtonElement>('[data-sdv-page="prev"]');
    const next = el.querySelector<HTMLButtonElement>('[data-sdv-page="next"]');
    if (prev) prev.disabled = table.state.page === 0;
    if (next) next.disabled = table.state.page >= table.pageCount - 1;
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
    if (e.type !== "hover") render();
  });
  return () => {
    unsubscribe();
    el.removeEventListener("click", onClick);
    el.removeEventListener("input", onInput);
    el.removeEventListener("mouseover", onHover);
    el.removeEventListener("mouseleave", onHover);
  };
}
