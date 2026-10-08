import type { Table } from "../engine.js";
import { escapeAttr, escapeHtml } from "./escape.js";
import { type RenderOptions, assemble, labelOf, renderParts, tableHTML } from "./parts.js";

/** J31 (A4, A5): the engine-driven render options, built in ONE place for renderInteractive, hydrate and `<SdvTable/>`. */
export function tableRenderOptions<Row>(table: Table<Row>): RenderOptions {
  const sel = table.getSelection();
  return {
    interactive: true,
    sort: table.state.sort,
    hidden: table.state.hidden,
    selected: new Set(table.rows.flatMap((r, i) => (sel.has(table.rowId(r)) ? [i] : []))),
    // decision 4 amended: under an external filter (a brush), scales span ALL rows so colours hold still
    ...(table.state.externalFilter === null ? {} : { domainRows: table.allRows }),
  };
}

export function pagerLabel<Row>(table: Table<Row>): string {
  return `${table.state.page + 1} / ${table.pageCount}`;
}

/** Global search box, then one filter input per `filterable` column. `value` is written last (React's attribute order). */
export function renderToolbar<Row>(table: Table<Row>): string {
  const global = `<input type="search" class="sdvt-global-filter" data-sdv-global-filter="" placeholder="Search" aria-label="Search all columns" value="${escapeAttr(table.state.globalFilter)}"/>`;
  const perColumn = table.columns
    .filter((c) => c.filterable === true)
    .map((c) => {
      const f = table.state.filters[c.key];
      const label = escapeHtml(labelOf(c));
      return `<input type="search" class="sdvt-filter" data-sdv-filter="${escapeAttr(c.key)}" placeholder="Filter ${label}" aria-label="Filter ${label}" value="${escapeAttr(typeof f === "string" ? f : "")}"/>`;
    })
    .join("");
  return `<div class="sdvt-toolbar">${global}${perColumn}</div>`;
}

export function renderPager<Row>(table: Table<Row>): string {
  const prev = table.state.page === 0 ? ' disabled=""' : "";
  const next = table.state.page >= table.pageCount - 1 ? ' disabled=""' : "";
  return `<nav class="sdvt-pager" data-sdv-pager="" aria-label="Pagination"><button type="button" class="sdvt-page" data-sdv-page="prev" aria-label="Previous page"${prev}>‹</button><span class="sdvt-page-label" data-sdv-page-label="">${pagerLabel(table)}</span><button type="button" class="sdvt-page" data-sdv-page="next" aria-label="Next page"${next}>›</button></nav>`;
}

/** The interactive document: the wrapper holding the style, toolbar, body block and pager, in that order. */
export function renderInteractive<Row>(table: Table<Row>, opts: RenderOptions = {}): string {
  const p = renderParts(table.spec, table.rows, { ...opts, ...tableRenderOptions(table) });
  const pager = table.state.pageSize === Number.POSITIVE_INFINITY ? "" : renderPager(table);
  return assemble(
    p,
    `${renderToolbar(table)}<div class="sdvt-body" data-sdv-body="">${tableHTML(p)}</div>${pager}`,
  );
}
