import {
  type CSSProperties,
  Fragment,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type Sort, type Table, type TableOptions, type TableSnapshot, createTable } from "../engine.js";
import {
  applyHover,
  captureFocus,
  handleClick,
  handleHover,
  handleInput,
  handleKeydown,
} from "../html/controls.js";
import { SR_ONLY, filterInputs, pagerLabel, tableRenderOptions } from "../html/interactive.js";
import { type RenderOptions, type RenderedParts, renderParts, tableHTML } from "../html/parts.js";
import type { TableSpec } from "../spec.js";

/**
 * The engine behind `useTable` and an owned `<SdvTable/>`, created ONCE per component instance. A new `rows` array
 * (even an equal copy) goes to `table.setRows`, so the user's sort, filters, page and selection survive a parent
 * re-render; only a STRUCTURAL spec change (its JSON, functions dropped) builds a new engine from the current props.
 * Function-valued spec fields (formatters, comparators) are therefore read from the spec the engine was built with.
 */
function useOwnedTable<Row>(spec: TableSpec<Row>, rows: readonly Row[], options: TableOptions): Table<Row> {
  // Not tableId(spec): an explicit spec.id short-circuits it, so a column change under a fixed id would keep a stale engine.
  // ponytail: one JSON.stringify per render, the same work tableId does for an id-less spec.
  const key = JSON.stringify(spec);
  const [held, setHeld] = useState(() => ({ key, table: createTable(spec, rows, options) }));
  let table = held.table;
  if (held.key !== key) {
    table = createTable(spec, rows, options); // React re-runs this render at once with the stored engine
    setHeld({ key, table });
  }
  // after the commit, never during render: setRows notifies subscribers, and React forbids updates from a render
  useIsoLayoutEffect(() => {
    if (table.allRows !== rows) table.setRows(rows);
  }, [table, rows]);
  return table;
}

/**
 * Subscribe a component to a `createTable` engine via useSyncExternalStore. The engine is created once per component:
 * a new `rows` array is handed to `table.setRows` (sort, filters, page and selection kept), and only a structural
 * `spec` change rebuilds it, so neither needs to be memoized. `options` are INITIAL state: a later change is ignored.
 */
export function useTable<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  options: TableOptions = {},
): { table: Table<Row>; snapshot: TableSnapshot<Row> } {
  const table = useOwnedTable(spec, rows, options);
  const snapshot = useSyncExternalStore(table.subscribe, table.getSnapshot, table.getSnapshot);
  return { table, snapshot };
}

/** `<SdvTable/>` building and owning its engine from `spec` and `rows`. */
export interface SdvTableOwnProps<Row> {
  /** the table to build; a later change with the same JSON (functions dropped) keeps the engine and its state */
  spec: TableSpec<Row>;
  /** the source rows; a new array (an equal copy included) keeps the user's sort, filters, page and selection */
  rows: readonly Row[];
  /** toolbar filters, sort headers and a pager driven by the engine; without it no engine is built */
  interactive?: boolean;
  /** INITIAL page size (beats `spec.interactive.pageSize`); like a React `default*` prop, a later change is ignored */
  pageSize?: number;
  /** INITIAL sort; like a React `default*` prop, a later change is ignored */
  sort?: Sort;
  /** `"none"` leaves the theme stylesheet out */
  css?: "inline" | "none";
  /** absent: pass a `table` to render an engine you own (`SdvTableLinkedProps`) */
  table?: undefined;
}
/**
 * J31 (A8): `<SdvTable/>` rendering an engine you own (from `createTable` or `useTable`, linked with
 * `linkSelection`). Its own spec and rows are rendered; `spec` and `rows` passed beside it are accepted and IGNORED
 * (change the rows with `table.setRows`). Initial state (`pageSize`, `sort`) belongs to that engine, so it is rejected.
 */
export interface SdvTableLinkedProps<Row> {
  /** the engine to render; the component re-renders on its changes */
  table: Table<Row>;
  /** ignored: the engine's own spec is rendered */
  spec?: TableSpec<Row>;
  /** ignored: the engine's own rows are rendered */
  rows?: readonly Row[];
  /** toolbar filters, sort headers and a pager; without it, the engine's current page as a static table */
  interactive?: boolean;
  /** `"none"` leaves the theme stylesheet out */
  css?: "inline" | "none";
  /** rejected: set it on the engine (`createTable(spec, rows, { pageSize })`) */
  pageSize?: undefined;
  /** rejected: set it on the engine (`createTable(spec, rows, { sort })`) */
  sort?: undefined;
}
/** Either an engine to render (`{ table }`) or the data to build one from (`{ spec, rows }`). */
export type SdvTableProps<Row> = SdvTableOwnProps<Row> | SdvTableLinkedProps<Row>;

/** Wrapper attributes in the string renderer's order: class, id, data-sdvt-theme, data-sdvt-density. */
function wrapperProps(p: RenderedParts): Record<string, string> {
  return {
    className: p.wrapperAttrs.class ?? "",
    id: p.wrapperAttrs.id ?? "",
    "data-sdvt-theme": p.wrapperAttrs["data-sdvt-theme"] ?? "",
    "data-sdvt-density": p.wrapperAttrs["data-sdvt-density"] ?? "",
  };
}
// Every string below comes from the escaping string renderer (parts.ts), never from raw data.
const raw = (html: string): { __html: string } => ({ __html: html });
// the string renderer's visually hidden <label> style, as the camelCase object React writes back in the same order
const SR_STYLE = Object.fromEntries(
  SR_ONLY.split(";").map((d) => {
    const [k = "", v = ""] = d.split(":");
    return [k.replace(/-(\w)/g, (_, ch: string) => ch.toUpperCase()), v];
  }),
) as CSSProperties;
// no layout effects during SSR (React 18 warns about them there)
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/** A visually hidden <label> + search <input>, the same markup as the string renderer's toolbar inputs. */
function searchBox(
  key: string,
  id: string,
  label: string,
  cls: string,
  data: Record<string, string>,
  value: string,
  onChange: (e: SyntheticEvent) => void,
  placeholder: string = label,
): ReactElement {
  return createElement(
    Fragment,
    { key },
    createElement("label", { htmlFor: id, style: SR_STYLE }, label),
    createElement("input", { type: "search", id, className: cls, ...data, placeholder, value, onChange }),
  );
}

/**
 * Same markup as `renderHTML` (test-enforced). Two forms: `{ spec, rows }` builds an engine (only when `interactive`;
 * a static table needs none) that lives as long as the component; `{ table }` renders an engine you own, statically
 * (its current page: filtered, sorted, sliced) or with controls. The table block is the string renderer's output;
 * React owns only the toolbar inputs and the pager, so typing in a filter never re-creates the input. The inputs are
 * controlled by the engine state, so a filter set from outside (another component, a linked selection) shows in its
 * box. A control or focusable cell element that a re-render replaces gets focus back, as in `hydrate`. The
 * Google-Fonts link is NOT rendered: put `fontsLinkFor(spec)` in the page head.
 *
 * Two cases remount the owned engine (`{ spec, rows }` form only; an engine passed as `table` is yours and is kept):
 * toggling `interactive` remounts it, losing the user's sort, filters, page and selection, since a static render
 * builds no engine. And the engine is keyed by the spec's JSON, which drops functions, so a deliberately changed
 * formatter or comparator under an otherwise equal spec does NOT take effect: change the element's React `key` to
 * rebuild the engine from the new spec.
 */
export function SdvTable<Row>(props: SdvTableProps<Row>): ReactElement {
  const { interactive = false, css } = props;
  if (props.table !== undefined)
    return createElement(TableView<Row>, { table: props.table, interactive, css });
  if (interactive) return createElement(OwnedTable<Row>, props);
  const p = renderParts(props.spec, props.rows, { fonts: false, ...(css !== undefined && { css }) });
  return staticBlock(p);
}

/** The static table: wrapper, theme sheet and table block, as one string-renderer HTML blob. */
function staticBlock(p: RenderedParts): ReactElement {
  const inner = `${p.sheet ? `<style>${p.sheet}</style>` : ""}${tableHTML(p)}`;
  return createElement("div", { ...wrapperProps(p), dangerouslySetInnerHTML: raw(inner) });
}

/** I2: the owned engine exists only here, so `{ table }` and static renders never build one. */
function OwnedTable<Row>({ spec, rows, pageSize, sort, css }: SdvTableOwnProps<Row>): ReactElement {
  const table = useOwnedTable(spec, rows, {
    ...(pageSize !== undefined && { pageSize }),
    ...(sort !== undefined && { sort }),
  });
  return createElement(TableView<Row>, { table, interactive: true, css });
}

function TableView<Row>({
  table,
  interactive,
  css,
}: {
  table: Table<Row>;
  interactive: boolean;
  css: "inline" | "none" | undefined;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<(() => void) | null>(null);
  // A50: remember the focused control while the DOM still holds it (the engine notifies before React re-renders).
  // A hover is a class toggle on the rendered rows, never a re-render (that would replace the row under the pointer).
  const subscribe = useCallback(
    (onChange: () => void) =>
      table.subscribe((e) => {
        if (e.type === "hover") {
          if (ref.current) applyHover(ref.current, table, e.id);
        } else if (restore.current === null && ref.current) restore.current = captureFocus(ref.current);
        onChange();
      }),
    [table],
  );
  useSyncExternalStore(subscribe, table.getSnapshot, table.getSnapshot); // J31: an external engine re-renders us too
  useIsoLayoutEffect(() => {
    // a render may have rebuilt the body rows; getHover, not a ref, so a (re)mount or a new table shows its own hover
    if (ref.current) applyHover(ref.current, table, table.getHover());
    restore.current?.();
    restore.current = null;
  });
  const base: RenderOptions = { fonts: false, ...(css !== undefined && { css }) };
  // M3: without controls, the engine's current page, coloured from all its rows (A49)
  if (!interactive)
    return staticBlock(
      renderParts(table.spec, table.rows, { ...base, ...tableRenderOptions(table), interactive: false }),
    );

  const p = renderParts(table.spec, table.rows, { ...base, ...tableRenderOptions(table) });
  const onInput = (e: SyntheticEvent): void => handleInput(table, e.target);
  const atStart = table.state.page === 0;
  const atEnd = table.state.page >= table.pageCount - 1;
  // A50: the hydrated SSR markup: an edge button is aria-disabled (not disabled), the label a polite live region
  const pager =
    table.state.pageSize === Number.POSITIVE_INFINITY
      ? null
      : createElement(
          "nav",
          { className: "sdvt-pager", "data-sdv-pager": "", "aria-label": "Pagination" },
          createElement(
            "button",
            {
              type: "button",
              className: "sdvt-page",
              "data-sdv-page": "prev",
              "aria-label": "Previous page",
              "aria-disabled": atStart ? "true" : undefined,
            },
            "‹",
          ),
          createElement(
            "span",
            { className: "sdvt-page-label", "data-sdv-page-label": "", "aria-live": "polite" },
            pagerLabel(table),
          ),
          createElement(
            "button",
            {
              type: "button",
              className: "sdvt-page",
              "data-sdv-page": "next",
              "aria-label": "Next page",
              "aria-disabled": atEnd ? "true" : undefined,
            },
            "›",
          ),
        );
  return createElement(
    "div",
    {
      ...wrapperProps(p),
      ref,
      onClick: (e: SyntheticEvent) => handleClick(table, e.target),
      onMouseOver: (e: SyntheticEvent) => handleHover(table, e.target), // J31 (A8): no attribute, so SSR is unchanged
      onMouseLeave: (e: SyntheticEvent) => handleHover(table, e.target),
      // Task 10: hotkeys and the grid's keys, as in hydrate; an event prop writes no attribute
      onKeyDown: (e: ReactKeyboardEvent) => {
        if (ref.current) handleKeydown(table, ref.current, e.nativeEvent);
      },
    },
    // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped renderer output (see `raw`)
    p.sheet ? createElement("style", { dangerouslySetInnerHTML: raw(p.sheet) }) : null,
    createElement(
      "div",
      { className: "sdvt-toolbar" },
      searchBox(
        "",
        `${p.id}-search`,
        "Search all columns",
        "sdvt-global-filter",
        { "data-sdv-global-filter": "" },
        table.state.globalFilter,
        onInput,
        "Search",
      ),
      // keyed by column, so hiding a column never hands another column's input (and its focus) over
      filterInputs(table, p.labels).map((f, j) =>
        searchBox(
          f.key,
          `${p.id}-filter-${j}`,
          `Filter ${f.label}`,
          "sdvt-filter",
          { "data-sdv-filter": f.key },
          f.value,
          onInput,
        ),
      ),
    ),
    createElement("div", {
      className: "sdvt-body",
      "data-sdv-body": "",
      // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped renderer output (see `raw`)
      dangerouslySetInnerHTML: raw(tableHTML(p)),
    }),
    pager,
  );
}
