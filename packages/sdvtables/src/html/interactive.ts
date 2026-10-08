import type { Table } from "../engine.js";
import { tableId } from "../table-id.js";
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
    // A49: always the full source rows, so colours, legends, outlier limits and row-accent palettes hold still
    // while the user pages, types, sorts or brushes, and index row selectors mean source rows
    domainRows: table.allRows,
  };
}

/** The pager's page text, `"<page> / <pageCount>"` with a 1-based page, e.g. `"1 / 3"`. */
export function pagerLabel<Row>(table: Table<Row>): string {
  return `${table.state.page + 1} / ${table.pageCount}`;
}

// a <label> that screen readers announce and sighted users never see; inline so the shared theme sheet stays unchanged
const SR_ONLY =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
/** `label` and `placeholder` are escaped HTML; `data` is a trusted attribute. */
const searchInput = (
  id: string,
  label: string,
  placeholder: string,
  cls: string,
  data: string,
  value: string,
): string =>
  `<label for="${escapeAttr(id)}" style="${SR_ONLY}">${label}</label><input type="search" id="${escapeAttr(id)}" class="${cls}" ${data} placeholder="${placeholder}" value="${escapeAttr(value)}"/>`;

/** Global search box, then one filter input per `filterable` column, each with a visually hidden `<label>`. `value` is written last (React's attribute order). */
export function renderToolbar<Row>(table: Table<Row>): string {
  const id = tableId(table.spec);
  const global = searchInput(
    `${id}-search`,
    "Search all columns",
    "Search",
    "sdvt-global-filter",
    'data-sdv-global-filter=""',
    table.state.globalFilter,
  );
  const perColumn = table.columns
    .filter((c) => c.filterable === true)
    .map((c, j) => {
      const f = table.state.filters[c.key];
      const label = `Filter ${escapeHtml(labelOf(c))}`;
      return searchInput(
        `${id}-filter-${j}`,
        label,
        label,
        "sdvt-filter",
        `data-sdv-filter="${escapeAttr(c.key)}"`,
        typeof f === "string" ? f : "",
      );
    })
    .join("");
  return `<div class="sdvt-toolbar">${global}${perColumn}</div>`;
}

/** The pager: Previous and Next buttons around {@link pagerLabel}, each disabled at its edge. Rendered only when `pageSize` is finite. */
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
