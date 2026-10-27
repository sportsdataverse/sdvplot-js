/**
 * The TanStack Table v9 adapter (`@tanstack/table-core` 9, MIT, and its React and Svelte adapters): an sdvtables spec
 * as the options `useTable` (React) or `createTable` (Svelte) takes. Columns keep the HTML table's labels, alignment,
 * number formats (a scaleNote and the rank suffix included) and sort, missing values last both ways; logo, wordmark,
 * headshot and superscript-rank cells come out as plain data that the caller's `render` turns into its framework's
 * markup. TanStack Table is headless: the caller owns the `<table>`, its CSS and its interactions.
 * Pure: TanStack Table is never imported at runtime (types only), and nothing touches the DOM, so the module imports on
 * a server and in any framework.
 */
import type { CellContext, ColumnDef, RowData, Row as TRow, TableFeatures } from "@tanstack/table-core";
import {
  type GridName,
  checkHeight,
  formatterFor,
  headshotUrls,
  logoMarks,
  missingLast,
  rankParts,
  rowIds,
  scaleNotes,
  unmapped,
  value,
} from "./_grid.js";
import { NUMERIC_KINDS, isMissing } from "./engine.js";
import { isBlank, toNumber } from "./format.js";
import { alignOf, labelOf } from "./html/parts.js";
import type { ColumnSpec, TableSpec } from "./spec.js";
import { teamNameSync } from "./team-name.js";

/** A cell sdvtables draws as more than text, as data: `render` turns it into the caller's framework markup. */
export type CellPart =
  | {
      readonly type: "image";
      /** "logo" and "wordmark": a team's mark; "headshot": a player's photo. */
      readonly kind: "logo" | "wordmark" | "headshot";
      readonly src: string;
      /** The team's name for a mark; "" for a headshot, which is decorative (the player's name sits in its row). */
      readonly alt: string;
      /** px */
      readonly height: number;
      /** The resolved team id or the player id, as the HTML table's `data-sdv-id`. */
      readonly id: string;
      /** A logo column with `includeName`: the cell's text, drawn after the image. */
      readonly text?: string;
    }
  | {
      /** A rank with `superscript` (the default): `num` then `suffix` in a `<sup>` of `size` ("1", "st"). */
      readonly type: "rank";
      readonly num: string;
      readonly suffix: string;
      readonly size: string;
    };
/** A column's CSS, from the spec: its alignment and width. */
export interface ColumnStyle {
  /** The HTML table's alignment: the spec's `align`, else right for numbers and centre for images. */
  readonly textAlign: "left" | "center" | "right";
  /** The spec's `width`, as given (any CSS width). */
  readonly width?: string;
}
/** `tanstackTable` options. */
export interface TanstackTableOptions<TFeatures extends TableFeatures> {
  /**
   * Your `tableFeatures({...})`: register `rowSortingFeature` and `sortedRowModel: createSortedRowModel()` for the
   * columns' sort. It is passed through, and fixes the columns' type to your table's features.
   */
  features: TFeatures;
  /**
   * Turns an image or superscript-rank cell into your framework's markup: a React element, or Svelte's
   * `renderSnippet(snippet, part)`. Without it, those cells are text: the team or player value, and "1st".
   */
  render?: (part: CellPart) => unknown;
}
/** What `tanstackTable` returns. */
export interface SdvTanstackTable<TFeatures extends TableFeatures, TData extends RowData> {
  /** For `useTable(options)` / `createTable(options)`, or spread with your own options (`initialState`, ...). */
  options: {
    features: TFeatures;
    columns: ColumnDef<TFeatures, TData>[];
    data: readonly TData[];
    /** With the spec's `rowKey` only. */
    getRowId?: (row: TData) => string;
  };
  /** Each column's CSS by column id (the spec's key), for its `<th>` and `<td>`. */
  columnStyle: Readonly<Record<string, ColumnStyle>>;
}

const TS: GridName = {
  fn: "tanstackTable",
  ns: "tanstack-table",
  grid: "TanStack Table",
  short: "TanStack Table",
  built: "options",
};

/**
 * An sdvtables spec as TanStack Table v9 options: `useTable(tanstackTable(spec, rows, { features }).options)`.
 *
 * - **Columns**: one accessor column per spec column, id the spec's key, header the HTML table's label (with a
 *   `scaleNote`'s suffix). Number cells (`num`, `int`, `pct`, `rank`, a `scaleNote`'s divisor and decimals) are the
 *   HTML table's text; a blank or unparseable number is missing (`undefined`), never 0.
 * - **Sorting**: sdvtables' own comparator (the column's `compare`, else by kind), with missing values last in both
 *   directions (`sortUndefined: "last"`). Register `rowSortingFeature` and `createSortedRowModel()` to use it.
 * - **Row ids**: with the spec's `rowKey`, `String(row[rowKey])`, checked unique and not blank (TanStack would merge two
 *   rows with one id); without it, TanStack's row index.
 * - **Images**: `logo`, `wordmark` and `headshot` cells, and superscript ranks, go through `render` as a `CellPart`.
 *   A team or player with no image keeps its text, with one warning. Team values may be abbreviations, names or
 *   numeric ids.
 *
 * Other kinds (pills, bars, team colours, sparklines...) show their plain value, with one warning per kind.
 * Synchronous: call `await prepare(spec)` (`@sportsdataverse/sdvtables/html`) first. Images are worked out once, from
 * `rows`: build again when the rows change, and keep the result stable between renders (module scope or a memo).
 *
 * @example
 * ```ts
 * import { createSortedRowModel, rowSortingFeature, tableFeatures } from "@tanstack/table-core";
 * import { defineTable } from "@sportsdataverse/sdvtables";
 * import { prepare } from "@sportsdataverse/sdvtables/html";
 * import { tanstackTable } from "@sportsdataverse/sdvtables/tanstack-table";
 *
 * // 2024 regular season, nflverse games
 * const rows = [
 *   { team: "KC", wins: 15, pf: 385 },
 *   { team: "BUF", wins: 13, pf: 525 },
 *   { team: "LAC", wins: 11, pf: 402 },
 * ];
 * const spec = defineTable<(typeof rows)[number]>()
 *   .columns((c) => [c.logo("team", { league: "nfl", height: 28 }), c.int("wins"), c.int("pf")])
 *   .rowKey("team")
 *   .build();
 * await prepare(spec);
 * const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
 * const { options } = tanstackTable(spec, rows, { features });
 * // in React: useTable(options), from @tanstack/react-table; in Svelte: createTable(options)
 * options.columns.map((c) => [c.id, c.header]);
 * ```
 */
export function tanstackTable<TFeatures extends TableFeatures, TData extends RowData>(
  spec: TableSpec<TData>,
  rows: readonly TData[],
  o: TanstackTableOptions<TFeatures>,
): SdvTanstackTable<TFeatures, TData> {
  const { scaled, labelSuffix } = scaleNotes(spec);
  const columnStyle: Record<string, ColumnStyle> = {};
  const columns = spec.columns.map((col) => {
    columnStyle[col.key] = {
      textAlign: alignOf(col),
      ...(col.width === undefined ? {} : { width: col.width }),
    };
    const asc = missingLast(col, rows)("asc"); // TanStack reverses it for a descending sort
    const numeric = NUMERIC_KINDS.has(col.kind);
    const def = {
      id: col.key,
      header: labelOf(col) + (labelSuffix.get(col.key) ?? ""),
      // a missing value is undefined, which sortUndefined keeps last both ways
      accessorFn: (row: TData): unknown => {
        const v = value(row, col.key);
        return numeric ? (toNumber(v) ?? undefined) : isMissing(v) ? undefined : v;
      },
      cell: cellOf(col, formatterFor(col, scaled)),
      sortFn: (a: TRow<TFeatures, TData>, b: TRow<TFeatures, TData>, id: string) =>
        asc(a.getValue(id), b.getValue(id)),
      sortUndefined: "last" as const,
      ...(col.sortable === undefined ? {} : { enableSorting: col.sortable }),
    };
    return def as unknown as ColumnDef<TFeatures, TData>;
  });

  function cellOf(
    col: ColumnSpec<TData>,
    format: ((v: unknown) => string) | undefined,
  ): (ctx: CellContext<TFeatures, TData, unknown>) => unknown {
    const text = (v: unknown): string => (format ? format(v) : isBlank(v) ? "" : String(v));
    const { render } = o;
    switch (col.kind) {
      case "text":
      case "num":
      case "int":
      case "pct":
        return (ctx) => text(ctx.getValue());
      case "rank":
        return (ctx) => {
          const r = col.superscript && render ? rankParts(ctx.getValue()) : null;
          return r === null || !render
            ? text(ctx.getValue())
            : render({ type: "rank", ...r, size: col.suffixSize });
        };
      case "logo":
      case "wordmark": {
        const h = checkHeight(col.height, col.kind);
        const marks = logoMarks(col, rows);
        const kind = col.kind;
        const withName = kind === "logo" && col.includeName;
        return (ctx) => {
          const raw = text(ctx.getValue());
          const t = raw.trim(); // the lookup key: 12, "12" and " 12 " are one team
          const m = marks.get(t);
          if (m === undefined || !render) return raw; // blank, unknown team or no image: the text, as the HTML table
          const alt = teamNameSync(col.league, m.id) ?? t;
          return render({
            type: "image",
            kind,
            src: m.url,
            alt,
            height: h,
            id: m.id,
            ...(withName ? { text: raw } : {}),
          });
        };
      }
      case "headshot": {
        const h = checkHeight(col.height, "headshot");
        const urls = headshotUrls(col, rows, TS);
        return (ctx) => {
          const raw = text(ctx.getValue());
          const src = urls.get(raw.trim());
          return src === undefined || !render
            ? raw
            : render({ type: "image", kind: "headshot", src, alt: "", height: h, id: raw.trim() });
        };
      }
      default:
        unmapped(col.kind, TS);
        return (ctx) => text(ctx.getValue());
    }
  }

  // a repeated or blank rowKey value would give TanStack one id for two rows; checked once, here
  const getRowId = spec.rowKey === undefined ? undefined : rowIds(rows, spec.rowKey, TS);
  return {
    options: { features: o.features, columns, data: rows, ...(getRowId === undefined ? {} : { getRowId }) },
    columnStyle,
  };
}
