import { TableSpecError } from "./errors.js";
import type { ColumnSpec, TableSpec } from "./spec.js";

export type SortDir = "asc" | "desc";
export interface Sort {
  readonly col: string;
  readonly dir: SortDir;
}
export type Predicate<Row> = (value: unknown, row: Row) => boolean;
export type FilterValue<Row> = Predicate<Row> | string | number | boolean;
export type Comparator = (a: unknown, b: unknown) => number;
/** J31: a row-level test set from outside the table (Phase 8 `linkSelection` passes a brush region). */
export type RowFilter<Row> = (row: Row) => boolean;
/** J31: what `subscribe` listeners receive. Every mutation emits exactly one event. */
export type TableEvent =
  | { readonly type: "change" }
  | { readonly type: "hover"; readonly id: string | null }
  | { readonly type: "select"; readonly ids: ReadonlySet<string> };

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
}
export interface TableSnapshot<Row> {
  readonly state: TableState<Row>;
  /** the visible page: filtered → sorted → sliced */
  readonly rows: readonly Row[];
  readonly filteredCount: number;
  /** always at least 1 */
  readonly pageCount: number;
}
export interface TableOptions {
  readonly pageSize?: number;
  readonly sort?: Sort;
}
export interface Table<Row> {
  readonly spec: TableSpec<Row>;
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
  /** J31: `String(row[spec.rowKey])` ("" when missing), else the row's index in `allRows` */
  rowId(row: Row): string;
  /** J31: same function again is a no-op; a new one resets the page */
  setExternalFilter(filter: RowFilter<Row> | null): void;
  /** J31: emits `{ type: "select" }`; an equal set is a no-op */
  setSelection(ids: ReadonlySet<string>): void;
  getSelection(): ReadonlySet<string>;
  /** J31: emits `{ type: "hover" }` without changing state; the same id twice in a row is a no-op */
  setHover(id: string | null): void;
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

export function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const compareNum: Comparator = (a, b) => Number(a) - Number(b);
export const compareText: Comparator = (a, b) => collator.compare(String(a), String(b));
export const compareDate: Comparator = (a, b) => {
  const t = (v: unknown): number => (v instanceof Date ? v.getTime() : new Date(String(v)).getTime());
  const x = t(a);
  const y = t(b);
  return Number.isNaN(x) || Number.isNaN(y) ? 0 : x - y;
};

const fieldOf = <Row>(row: Row, key: string): unknown => (row as Record<string, unknown>)[key];

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

export function findColumn<Row>(spec: TableSpec<Row>, key: string): ColumnSpec<Row> {
  const col = spec.columns.find((c) => c.key === key);
  if (!col)
    throw new TableSpecError(
      `unknown column "${key}"; columns are ${spec.columns.map((c) => c.key).join(", ")}`,
    );
  return col;
}

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
  };
  const listeners = new Set<(event: TableEvent) => void>();
  const emit = (event: TableEvent): void => {
    for (const fn of [...listeners]) fn(event);
  };
  const key = spec.rowKey;
  const indexOf = key === undefined ? new Map(rows.map((r, i) => [r, i] as const)) : null;
  const rowId = (row: Row): string => {
    if (key === undefined) {
      const i = indexOf?.get(row);
      return i === undefined ? "" : String(i);
    }
    const v = fieldOf(row, key);
    return isMissing(v) ? "" : String(v);
  };
  let hovered: string | null = null;
  const compute = (): TableSnapshot<Row> => {
    const filtered = applyFilters(spec, rows, state);
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
    emit(event);
  };
  return {
    spec,
    allRows: rows,
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
    setHover(id) {
      if (id === hovered) return;
      hovered = id;
      emit({ type: "hover", id });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => snapshot,
  };
}
