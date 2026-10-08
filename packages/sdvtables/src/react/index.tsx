import {
  type CSSProperties,
  Fragment,
  type ReactElement,
  type SyntheticEvent,
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { type Sort, type Table, type TableOptions, type TableSnapshot, createTable } from "../engine.js";
import { captureFocus, handleClick, handleHover, handleInput } from "../html/controls.js";
import { SR_ONLY, filterInputs, pagerLabel, tableRenderOptions } from "../html/interactive.js";
import { type RenderOptions, type RenderedParts, renderParts, tableHTML } from "../html/parts.js";
import type { TableSpec } from "../spec.js";

/** Subscribe a component to a `createTable` engine via useSyncExternalStore. Options seed the initial state only. */
export function useTable<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  options: TableOptions = {},
): { table: Table<Row>; snapshot: TableSnapshot<Row> } {
  // biome-ignore lint/correctness/useExhaustiveDependencies: options are initial state, not a dependency
  const table = useMemo(() => createTable(spec, rows, options), [spec, rows]);
  const snapshot = useSyncExternalStore(table.subscribe, table.getSnapshot, table.getSnapshot);
  return { table, snapshot };
}

export interface SdvTableProps<Row> {
  spec: TableSpec<Row>;
  rows: readonly Row[];
  /** toolbar filters, sort headers and a pager driven by the engine */
  interactive?: boolean;
  pageSize?: number;
  sort?: Sort;
  css?: "inline" | "none";
  /** J31 (A8): render this engine (e.g. from `useTable`, linked with `linkSelection`) instead of creating one */
  table?: Table<Row>;
}

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
 * Same markup as `renderHTML` (test-enforced): the table block is the string renderer's output; React owns only the
 * toolbar inputs and the pager, so typing in a filter never re-creates the input. The inputs are controlled by the
 * engine state, so a filter set from outside (another component, a linked selection) shows in its box. A control or
 * focusable cell element that a re-render replaces gets focus back, as in `hydrate`. The Google-Fonts link is NOT
 * rendered: put `fontsLinkFor(spec)` in the page head.
 */
export function SdvTable<Row>({
  spec,
  rows,
  interactive = false,
  pageSize,
  sort,
  css,
  table: external,
}: SdvTableProps<Row>): ReactElement {
  const owned = useTable(spec, rows, {
    ...(pageSize !== undefined && { pageSize }),
    ...(sort !== undefined && { sort }),
  });
  const table = external ?? owned.table;
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<(() => void) | null>(null);
  // A50: remember the focused control while the DOM still holds it (the engine notifies before React re-renders)
  const subscribe = useCallback(
    (onChange: () => void) =>
      table.subscribe((e) => {
        if (e.type !== "hover" && restore.current === null && ref.current)
          restore.current = captureFocus(ref.current);
        onChange();
      }),
    [table],
  );
  useSyncExternalStore(subscribe, table.getSnapshot, table.getSnapshot); // J31: an external engine re-renders us too
  useIsoLayoutEffect(() => {
    restore.current?.();
    restore.current = null;
  });
  const base: RenderOptions = { fonts: false, ...(css !== undefined && { css }) };

  if (!interactive) {
    const p = renderParts(spec, rows, base);
    const inner = `${p.sheet ? `<style>${p.sheet}</style>` : ""}${tableHTML(p)}`;
    return createElement("div", { ...wrapperProps(p), dangerouslySetInnerHTML: raw(inner) });
  }

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
