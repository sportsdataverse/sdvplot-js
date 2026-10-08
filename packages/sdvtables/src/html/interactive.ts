import type { Table } from "../engine.js";
import { tableId } from "../table-id.js";
import { escapeAttr, escapeHtml } from "./escape.js";
import { type RenderOptions, assemble, renderParts, tableHTML } from "./parts.js";

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
    // Task 10 (A48): a selectable grid whose one tab stop is the cursor row
    grid: table.state.cursor,
  };
}

/** The pager's page text, `"Page <page> of <pageCount>"` with a 1-based page, e.g. `"Page 1 of 3"`. */
export function pagerLabel<Row>(table: Table<Row>): string {
  return `Page ${table.state.page + 1} of ${table.pageCount}`;
}

/**
 * M8: one input per filterable column that is SHOWN, labelled with its shown header text (`labels`, from
 * `RenderedParts.labels`, so a marginalia rename or scaleNote suffix carries over). A hidden column gets no input; a
 * filter already set on it stays active. The one rule renderToolbar, hydrate and `<SdvTable/>` all follow.
 */
export function filterInputs<Row>(
  table: Table<Row>,
  labels: ReadonlyMap<string, string>,
): { key: string; label: string; value: string }[] {
  return table.columns.flatMap((c) => {
    const label = labels.get(c.key);
    const f = table.state.filters[c.key];
    return c.filterable === true && label !== undefined
      ? [{ key: c.key, label, value: typeof f === "string" ? f : "" }]
      : [];
  });
}

// a <label> that screen readers announce and sighted users never see; inline so the shared theme sheet stays unchanged
export const SR_ONLY: string =
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

/**
 * Global search box, then one filter input per shown `filterable` column, each with a visually hidden `<label>`
 * naming the column by its shown header text. `value` is written last (React's attribute order). `labels` defaults
 * to a render of the table's current page; pass `renderParts(…).labels` when you already have one.
 */
export function renderToolbar<Row>(
  table: Table<Row>,
  labels: ReadonlyMap<string, string> = renderParts(table.spec, table.rows, tableRenderOptions(table)).labels,
): string {
  const id = tableId(table.spec);
  const global = searchInput(
    `${id}-search`,
    "Search all columns",
    "Search",
    "sdvt-global-filter",
    'data-sdv-global-filter=""',
    table.state.globalFilter,
  );
  const perColumn = filterInputs(table, labels)
    .map((f, j) => {
      const label = `Filter ${escapeHtml(f.label)}`;
      return searchInput(
        `${id}-filter-${j}`,
        label,
        label,
        "sdvt-filter",
        `data-sdv-filter="${escapeAttr(f.key)}"`,
        f.value,
      );
    })
    .join("");
  return `<div class="sdvt-toolbar">${global}${perColumn}</div>`;
}

/**
 * The pager: Previous and Next buttons around {@link pagerLabel}, a polite live region. Rendered only when
 * `pageSize` is finite. An edge button is `aria-disabled`, not `disabled`, so a keyboard user paging to the end
 * keeps focus on it (a disabled button drops focus to the page body); a click on it does nothing.
 */
export function renderPager<Row>(table: Table<Row>): string {
  const prev = table.state.page === 0 ? ' aria-disabled="true"' : "";
  const next = table.state.page >= table.pageCount - 1 ? ' aria-disabled="true"' : "";
  return `<nav class="sdvt-pager" data-sdv-pager="" aria-label="Pagination"><button type="button" class="sdvt-page" data-sdv-page="prev" aria-label="Previous page"${prev}>‹</button><span class="sdvt-page-label" data-sdv-page-label="" aria-live="polite">${pagerLabel(table)}</span><button type="button" class="sdvt-page" data-sdv-page="next" aria-label="Next page"${next}>›</button></nav>`;
}

/** The interactive document: the wrapper holding the style, toolbar, body block and pager, in that order. */
export function renderInteractive<Row>(table: Table<Row>, opts: RenderOptions = {}): string {
  const p = renderParts(table.spec, table.rows, { ...opts, ...tableRenderOptions(table) });
  const pager = table.state.pageSize === Number.POSITIVE_INFINITY ? "" : renderPager(table);
  return assemble(
    p,
    `${renderToolbar(table, p.labels)}<div class="sdvt-body" data-sdv-body="">${tableHTML(p)}</div>${pager}`,
  );
}
