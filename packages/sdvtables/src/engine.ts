import type { RowFilter } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "./errors.js";
import type { ColumnSpec, TableSpec } from "./spec.js";

// J31: the row test setExternalFilter takes is sdvplot's own type, so a selection store's brush predicate fits as is
export type { RowFilter };

export type SortDir = "asc" | "desc";
export interface Sort {
  readonly col: string;
  readonly dir: SortDir;
}
/** A column filter as a function: tests the column's cell `value` (the whole `row` comes along for context). */
export type ValuePredicate<Row> = (value: unknown, row: Row) => boolean;
/** What `setFilter` takes for a column: a predicate on its value, a case-insensitive substring, or an exact number or boolean. */
export type FilterValue<Row> = ValuePredicate<Row> | string | number | boolean;
export type Comparator = (a: unknown, b: unknown) => number;
/** J31: what `subscribe` listeners receive. Every mutation emits exactly one event. */
export type TableEvent =
  | { readonly type: "change" }
  | { readonly type: "hover"; readonly id: string | null }
  | { readonly type: "select"; readonly ids: ReadonlySet<string> };
/**
 * Task 10 (A45, A48): the keyboard cursor of an interactive table. `row` is the body row holding the grid's one tab
 * stop, as a page-relative index (that row's `data-row`); `col` is the column `s` sorts, null until `h`/`l` picks one.
 */
export interface TableCursor {
  readonly row: number;
  readonly col: string | null;
}

/** The whole user-controlled state of a table: sort, filters, page, hidden columns, and the J31 link fields. Immutable; every mutation replaces it. */
export interface TableState<Row> {
  readonly sort: Sort | null;
  readonly filters: Readonly<Record<string, FilterValue<Row>>>;
  readonly globalFilter: string;
  /** 0-based */
  readonly page: number;
  /** positive integer, or Infinity for "all rows" */
  readonly pageSize: number;
  /** column keys hidden by toggleColumn */
  readonly hidden: readonly string[];
  /** J31: set by setExternalFilter; ANDed with the column and global filters */
  readonly externalFilter: RowFilter<Row> | null;
  /** J31: row ids (see `rowId`); NOT pruned to the rows present, so a linked store's ids round-trip intact */
  readonly selection: ReadonlySet<string>;
  /** Task 10: the keyboard cursor; its row is kept on the current page */
  readonly cursor: TableCursor;
}
/** What `Table.getSnapshot()` returns: the state plus the derived visible page. Referentially stable until the next mutation. */
export interface TableSnapshot<Row> {
  readonly state: TableState<Row>;
  /** the visible page: filtered → sorted → sliced */
  readonly rows: readonly Row[];
  readonly filteredCount: number;
  /** always at least 1 */
  readonly pageCount: number;
}
/** Initial state for `createTable`; `pageSize` beats `spec.interactive.pageSize`, and `sort` must name a spec column. */
export interface TableOptions {
  readonly pageSize?: number;
  readonly sort?: Sort;
}
/**
 * The headless table engine: holds the rows and a `TableState`, derives the visible page, and notifies subscribers.
 * Renderers (static HTML, hydrate, React) read `rows`/`columns` and call the setters; nothing here touches the DOM.
 *
 * @example A hover set before any view attaches: the view lights it when it does (getHover)
 * ```ts
 * import { createTable, defineTable } from "@sportsdataverse/sdvtables";
 * import { hydrate, renderHTML } from "@sportsdataverse/sdvtables/html";
 *
 * // 2024 AFC: Kansas City 15 wins, Buffalo 13
 * const spec = defineTable<{ team: string; wins: number }>()
 *   .columns((c) => [c.text("team"), c.int("wins")])
 *   .rowKey("team")
 *   .build();
 * const table = createTable(spec, [
 *   { team: "KC", wins: 15 },
 *   { team: "BUF", wins: 13 },
 * ]);
 * table.setHover("BUF"); // a linked figure's hover, before the table is on the page
 * table.getHover(); // "BUF"
 * const root = document.createElement("div");
 * root.innerHTML = renderHTML(table, { fonts: false });
 * hydrate(root, table); // Buffalo's row gets sdvt-hover as it attaches
 * root;
 * ```
 */
export interface Table<Row> {
  readonly spec: TableSpec<Row>;
  /** the source rows: the ones given to `createTable`, or the last `setRows` */
  readonly allRows: readonly Row[];
  readonly state: TableState<Row>;
  readonly rows: readonly Row[];
  readonly filteredCount: number;
  readonly pageCount: number;
  /** visible columns in spec order */
  readonly columns: readonly ColumnSpec<Row>[];
  setSort(col: string, dir: SortDir | null): void;
  setFilter(col: string, filter: FilterValue<Row> | null | undefined): void;
  setGlobalFilter(text: string): void;
  setPage(n: number): void;
  setPageSize(n: number): void;
  toggleColumn(col: string, visible?: boolean): void;
  /**
   * Replace the source rows (a React parent's new array, a live feed). Sort, filters, the external filter, hidden
   * columns and selection are kept; the page is clamped to the new page count; one `"change"` event. Without a
   * `rowKey`, row ids are indices into the NEW rows, so a kept selection means the rows at those positions.
   */
  setRows(rows: readonly Row[]): void;
  /** J31: `String(row[spec.rowKey])` ("" when missing), else the row's index in `allRows` */
  rowId(row: Row): string;
  /** J31: same function again is a no-op; a new one resets the page */
  setExternalFilter(filter: RowFilter<Row> | null): void;
  /** J31: emits `{ type: "select" }`; an equal set is a no-op */
  setSelection(ids: ReadonlySet<string>): void;
  getSelection(): ReadonlySet<string>;
  /** J31: emits `{ type: "hover" }` without changing state; the same id twice in a row is a no-op */
  setHover(id: string | null): void;
  /**
   * J31: the last `setHover` id, or null. A view that attaches (`hydrate`) or mounts (`<SdvTable table/>`) after a
   * hover reads it, since no event comes until the hover changes.
   */
  getHover(): string | null;
  /**
   * Task 10: move the keyboard cursor. `row` is clamped to the current page; `col` must name a spec column, or be
   * null. One `"change"` event; an equal cursor (after clamping) is a no-op, and a non-finite `row` is ignored.
   */
  setCursor(row: number, col: string | null): void;
  subscribe(fn: (event: TableEvent) => void): () => void;
  /** referentially stable until the next mutation — what useSyncExternalStore reads */
  getSnapshot(): TableSnapshot<Row>;
}

/** Phase 4 column kinds whose values sort numerically. */
export const NUMERIC_KINDS: ReadonlySet<string> = new Set([
  "num",
  "int",
  "pct",
  "rank",
  "delta",
  "tally",
  "colorPills",
  "colorRanks",
  "percentileBar",
]);

/** null, undefined, "", NaN, and an invalid `Date` are missing; `withMissingLast` sorts them last. */
export function isMissing(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (typeof v === "number" && Number.isNaN(v)) ||
    (v instanceof Date && Number.isNaN(v.getTime()))
  );
}

// Pinned to "en" so the SSR process and the viewer's browser sort text identically.
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export const compareNum: Comparator = (a, b) => Number(a) - Number(b);
/** Text sorts under the `en` locale (numeric-aware, case- and accent-insensitive), never the host default, so server and client agree. */
export const compareText: Comparator = (a, b) => collator.compare(String(a), String(b));
/** Date values compare by time; an unparsable one is missing (see `isMissing`), so the comparator stays transitive. */
export const compareDate: Comparator = (a, b) => {
  const t = (v: unknown): number => (v instanceof Date ? v.getTime() : new Date(String(v)).getTime());
  const x = t(a);
  const y = t(b);
  return Number.isNaN(x) || Number.isNaN(y) ? 0 : x - y;
};

const fieldOf = <Row>(row: Row, key: string): unknown => (row as Record<string, unknown>)[key];

/**
 * The comparator `applySort` uses for `col`: its own `compare`, else numeric for a numeric kind or numeric samples, by
 * time for `Date` samples, else `en`-locale text.
 * Engine plumbing for custom renderers: it may change before 1.0.
 *
 * @beta
 */
export function comparatorFor<Row>(col: ColumnSpec<Row>, rows: readonly Row[]): Comparator {
  if (col.compare) return col.compare as Comparator; // Phase 4 types it on Row[K]; the engine compares unknowns
  if (NUMERIC_KINDS.has(col.kind)) return compareNum;
  const sample = rows.map((r) => fieldOf(r, col.key)).find((v) => !isMissing(v));
  return typeof sample === "number" ? compareNum : sample instanceof Date ? compareDate : compareText;
}

/** Missing values sort last in BOTH directions; never returns NaN. */
export function withMissingLast(cmp: Comparator, dir: SortDir): Comparator {
  return (a, b) => {
    const ma = isMissing(a);
    const mb = isMissing(b);
    if (ma || mb) return ma === mb ? 0 : ma ? 1 : -1;
    const c = cmp(a, b);
    if (Number.isNaN(c)) return 0;
    return dir === "asc" ? c : -c;
  };
}

/**
 * The spec's column with this key; throws `TableSpecError` naming every column when there is none.
 * Engine plumbing for custom renderers: it may change before 1.0.
 *
 * @beta
 */
export function findColumn<Row>(spec: TableSpec<Row>, key: string): ColumnSpec<Row> {
  const col = spec.columns.find((c) => c.key === key);
  if (!col)
    throw new TableSpecError(
      `unknown column "${key}"; columns are ${spec.columns.map((c) => c.key).join(", ")}`,
    );
  return col;
}

/**
 * A sorted copy of `rows` (stable; missing values last in both directions); `sort` null keeps the input order.
 * Engine plumbing for custom renderers: it may change before 1.0.
 *
 * @beta
 */
export function applySort<Row>(spec: TableSpec<Row>, rows: readonly Row[], sort: Sort | null): Row[] {
  if (!sort) return [...rows];
  const col = findColumn(spec, sort.col);
  const cmp = withMissingLast(comparatorFor(col, rows), sort.dir);
  // Array.prototype.sort is stable since ES2019, so ties keep input order.
  return [...rows].sort((a, b) => cmp(fieldOf(a, col.key), fieldOf(b, col.key)));
}

export function matches<Row>(filter: FilterValue<Row>, value: unknown, row: Row): boolean {
  if (typeof filter === "function") return filter(value, row);
  if (typeof filter === "string")
    return String(value ?? "")
      .toLowerCase()
      .includes(filter.toLowerCase());
  return value === filter;
}

// ponytail: O(rows × columns) scan per change; index the lower-cased text if tables pass ~50k rows.
/**
 * The rows `state` keeps, in input order: its external filter, every column filter and the global search over the
 * visible columns, all ANDed.
 * Engine plumbing for custom renderers: it may change before 1.0.
 *
 * @beta
 */
export function applyFilters<Row>(spec: TableSpec<Row>, rows: readonly Row[], state: TableState<Row>): Row[] {
  const active = Object.entries(state.filters).map(([key, f]) => [findColumn(spec, key), f] as const);
  const q = state.globalFilter.trim().toLowerCase();
  const searchable = spec.columns.filter((c) => !state.hidden.includes(c.key));
  const external = state.externalFilter;
  return rows.filter(
    (row) =>
      (external === null || external(row)) &&
      active.every(([col, f]) => matches(f, fieldOf(row, col.key), row)) &&
      (q === "" ||
        searchable.some((c) =>
          String(fieldOf(row, c.key) ?? "")
            .toLowerCase()
            .includes(q),
        )),
  );
}

/**
 * Page `page` (0-based, clamped to the pages there are) of `rows` at `pageSize` (Infinity: all of them), and the
 * page count, at least 1.
 * Engine plumbing for custom renderers: it may change before 1.0.
 *
 * @beta
 */
export function paginate<Row>(
  rows: readonly Row[],
  page: number,
  pageSize: number,
): { rows: Row[]; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize)); // n / Infinity → 0 → 1 page
  const p = Math.min(Math.max(0, page), pageCount - 1);
  const slice =
    pageSize === Number.POSITIVE_INFINITY ? [...rows] : rows.slice(p * pageSize, (p + 1) * pageSize);
  return { rows: slice, pageCount };
}

/** Header-click cycle shared by hydrate and React: asc → desc → none. */
export function nextSortDir(current: Sort | null, col: string): SortDir | null {
  if (!current || current.col !== col) return "asc";
  return current.dir === "asc" ? "desc" : null;
}

function checkPageSize(n: number): number {
  if (n === Number.POSITIVE_INFINITY) return n;
  if (!Number.isInteger(n) || n < 1)
    throw new TableSpecError(`pageSize must be a positive integer or Infinity, got ${String(n)}`);
  return n;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));
const CHANGE: TableEvent = { type: "change" };

/**
 * Build a headless `Table` over `rows`: sort, filter, paginate, hide columns, and subscribe to changes.
 * Throws `TableSpecError` for an unknown column or an invalid page size; never mutates `rows`.
 */
export function createTable<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  options: TableOptions = {},
): Table<Row> {
  if (options.sort) findColumn(spec, options.sort.col);
  let state: TableState<Row> = {
    sort: options.sort ?? null,
    filters: {},
    globalFilter: "",
    page: 0,
    pageSize: checkPageSize(options.pageSize ?? spec.interactive?.pageSize ?? Number.POSITIVE_INFINITY),
    hidden: [],
    externalFilter: null,
    selection: new Set(),
    cursor: { row: 0, col: null },
  };
  const listeners = new Set<(event: TableEvent) => void>();
  const emit = (event: TableEvent): void => {
    for (const fn of [...listeners]) fn(event);
  };
  const key = spec.rowKey;
  let source = rows;
  let indexOf: Map<Row, number> | null = null;
  let warned = false;
  const rowId = (row: Row): string => {
    if (key === undefined) {
      const i = indexOf?.get(row);
      return i === undefined ? "" : String(i);
    }
    const v = fieldOf(row, key);
    return isMissing(v) ? "" : String(v);
  };
  const setSource = (next: readonly Row[]): void => {
    source = next;
    if (key === undefined) {
      indexOf = new Map(next.map((r, i) => [r, i] as const));
      return;
    }
    if (warned) return;
    // Duplicate ids collapse to one link id (selecting one highlights all); say so once per table.
    const ids = next.map(rowId).filter((id) => id !== "");
    const dupes = ids.length - new Set(ids).size;
    if (dupes > 0) {
      warned = true;
      console.warn(
        `sdvtables: rowKey "${key}" is not unique — ${dupes} duplicate id(s); linked selection will merge them`,
      );
    }
  };
  setSource(rows);
  let hovered: string | null = null;
  const compute = (): TableSnapshot<Row> => {
    const filtered = applyFilters(spec, source, state);
    const sorted = applySort(spec, filtered, state.sort);
    const { rows: pageRows, pageCount } = paginate(sorted, state.page, state.pageSize);
    return { state, rows: pageRows, filteredCount: filtered.length, pageCount };
  };
  let snapshot = compute();
  const update = (patch: Partial<TableState<Row>>, event: TableEvent = CHANGE): void => {
    state = { ...state, ...patch };
    snapshot = compute();
    if (state.page > snapshot.pageCount - 1) {
      state = { ...state, page: snapshot.pageCount - 1 };
      snapshot = compute();
    }
    const last = Math.max(0, snapshot.rows.length - 1);
    if (state.cursor.row > last) {
      // Task 10: a filter, page or new rows that shrink the page pull the cursor row back onto it
      state = { ...state, cursor: { ...state.cursor, row: last } };
      snapshot = { ...snapshot, state };
    }
    emit(event);
  };
  return {
    spec,
    get allRows() {
      return source;
    },
    get state() {
      return snapshot.state;
    },
    get rows() {
      return snapshot.rows;
    },
    get filteredCount() {
      return snapshot.filteredCount;
    },
    get pageCount() {
      return snapshot.pageCount;
    },
    get columns() {
      return spec.columns.filter((c) => !snapshot.state.hidden.includes(c.key));
    },
    setSort(col, dir) {
      if (dir !== null) findColumn(spec, col);
      update({ sort: dir === null ? null : { col, dir }, page: 0 });
    },
    setFilter(col, filter) {
      findColumn(spec, col);
      const { [col]: _dropped, ...rest } = state.filters;
      const filters =
        filter === null || filter === undefined || filter === "" ? rest : { ...rest, [col]: filter };
      update({ filters, page: 0 });
    },
    setGlobalFilter(text) {
      update({ globalFilter: text, page: 0 });
    },
    setPage(n) {
      if (!Number.isFinite(n)) return; // NaN/±Infinity: a caller bug, not a page
      update({ page: Math.max(0, Math.min(Math.trunc(n), snapshot.pageCount - 1)) });
    },
    setPageSize(n) {
      update({ pageSize: checkPageSize(n), page: 0 });
    },
    toggleColumn(col, visible) {
      findColumn(spec, col);
      const hiddenNow = state.hidden.includes(col);
      const hide = visible === undefined ? !hiddenNow : !visible;
      const hidden = hide
        ? hiddenNow
          ? state.hidden
          : [...state.hidden, col]
        : state.hidden.filter((c) => c !== col);
      update({ hidden, sort: hide && state.sort?.col === col ? null : state.sort });
    },
    setRows(next) {
      setSource(next);
      update({}); // every state field kept; update re-clamps the page and emits once
    },
    rowId,
    setExternalFilter(filter) {
      if (filter === state.externalFilter) return; // no recompute, no echo: the J31 loop guard
      update({ externalFilter: filter, page: 0 });
    },
    setSelection(ids) {
      if (sameSet(ids, state.selection)) return;
      const selection: ReadonlySet<string> = new Set(ids); // a copy: the caller may reuse its set
      update({ selection }, { type: "select", ids: selection });
    },
    getSelection: () => state.selection,
    setCursor(row, col) {
      if (!Number.isFinite(row)) return; // as setPage: NaN/±Infinity is a caller bug, not a row
      if (col !== null) findColumn(spec, col);
      const r = Math.max(0, Math.min(Math.trunc(row), snapshot.rows.length - 1));
      if (r === state.cursor.row && col === state.cursor.col) return;
      update({ cursor: { row: r, col } });
    },
    setHover(id) {
      if (id === hovered) return;
      hovered = id;
      emit({ type: "hover", id });
    },
    getHover: () => hovered,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => snapshot,
  };
}
