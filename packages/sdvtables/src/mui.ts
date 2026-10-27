/**
 * The MUI X Data Grid adapter (`@mui/x-data-grid` 9, the MIT community package only): an sdvtables spec as a
 * `<DataGrid>`'s props. Columns keep sdvtables' number formats, alignment and px widths; logo, wordmark and headshot
 * columns draw their images through `renderCell`; team-coloured rows and cells take sdvplot's team palette with
 * black or white text by contrast; the theme's tokens (fonts, colours, density, stripes) become the grid's `sx`.
 * Pure: MUI is never imported (the props here are structural, read from `@mui/x-data-grid` 9.15 and checked against
 * its own types); React's `createElement` builds the images, so the grid also renders on the server.
 */
import {
  type IdSystem,
  type League,
  type SeasonInput,
  type Which,
  hex6,
  mix,
  onColor,
} from "@sportsdataverse/sdvplot";
import { teamColorPalette } from "@sportsdataverse/sdvplot/mui";
import { Fragment, type ReactElement, createElement } from "react";
import {
  type Fill,
  type GridName,
  cell,
  checkHeight,
  formatterFor,
  headshotUrls,
  logoMarks,
  missingLast,
  opaque,
  pxWidth,
  rankParts,
  rowIds,
  scaleNotes,
  teamColorOf,
  teamRowFills,
  tint,
  unmapped,
  value,
} from "./_grid.js";
import { NUMERIC_KINDS } from "./engine.js";
import { toNumber } from "./format.js";
import { alignOf, labelOf } from "./html/parts.js";
import type { Align, ColumnSpec, TableSpec } from "./spec.js";
import { teamNameSync } from "./team-name.js";
import { resolveTheme } from "./themes/index.js";
import type { ThemeTokens } from "./themes/tokens.js";

/** What MUI hands a column's `renderCell` and `cellClassName`: the subset read here. */
export interface GridCellParamsLike<Row> {
  /** The row the cell is in. */
  readonly row: Row;
  /** The cell's value: `row[field]`. */
  readonly value?: unknown;
}
/** What MUI hands `getRowClassName`: the subset read here. */
export interface GridRowClassParamsLike<Row> {
  /** The row. */
  readonly row: Row;
  /** The row's index on the current page, from 0: odd rows take the theme's stripe. */
  readonly indexRelativeToCurrentPage: number;
}
/** One MUI `GridColDef`: the fields this adapter sets. */
export interface SdvGridColDef<Row> {
  /** The row key the column reads. */
  field: string;
  /** The column's label, as the HTML table writes it. */
  headerName: string;
  /** The spec's `subheader`, shown as the header's tooltip. */
  description?: string;
  /** "number" for sdvtables' numeric kinds (MUI then sorts and filters as numbers). */
  type?: "string" | "number";
  align: Align;
  headerAlign: Align;
  /** The spec's px width as a number; other CSS widths are left to MUI (with one warning). */
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  /** "flex" for image cells, so MUI centres them vertically. */
  display?: "text" | "flex";
  /** Numeric kinds: the cell's number, `null` for a blank or unparseable value (so MUI never reads "" as 0). */
  valueGetter?: (value: never) => number | null;
  /** The cell's text through sdvtables' number formats. */
  valueFormatter?: (value: never) => string;
  /** sdvtables' own sort for the column (its `compare`, else by kind), missing values last in both directions. */
  getSortComparator?: (
    direction: "asc" | "desc" | null | undefined,
  ) => ((a: unknown, b: unknown) => number) | undefined;
  /** A logo, wordmark or headshot image, or a rank with a superscript suffix. */
  renderCell?: (params: GridCellParamsLike<Row>) => ReactElement | string;
  /** A team colour class (`teamColorBg`, `teamColorBar`) styled by the grid's `sx`. */
  cellClassName?: (params: GridCellParamsLike<Row>) => string;
}
/** A nested `sx` style object: selectors map to CSS properties (and CSS variables). */
export interface GridSx {
  readonly [selectorOrProperty: string]: string | number | GridSx;
}
/** What `dataGridProps` returns: spread it onto `<DataGrid rows={rows} {...props} />`. */
export interface SdvDataGridProps<Row> {
  columns: SdvGridColDef<Row>[];
  /** `String(row[spec.rowKey])`, else the row's index in `rows`; checked unique and not blank when built. */
  getRowId: (row: Row) => string;
  /** The row's team colour class (`teamRows`), else the theme's stripe on odd rows. */
  getRowClassName: (params: GridRowClassParamsLike<Row>) => string;
  /** The theme as MUI X Data Grid styles, plus the team colour classes. */
  sx: GridSx;
  /** The theme's density as MUI's: compact is "compact", comfortable is "standard" and social is "comfortable". */
  density: "compact" | "standard" | "comfortable";
  /** MUI's base row height (MUI multiplies it by the density's factor), tall enough for the tallest image. */
  rowHeight: number;
}
/** `dataGridProps` options. */
export interface DataGridPropsOptions<Row> {
  /**
   * Fill each row with its team's colour, from the row's `key` value (an abbreviation, a name or a numeric id).
   * The colours are sdvplot's team palette for the theme's background (`teamColorPalette` from
   * `@sportsdataverse/sdvplot/mui`: 3:1 against it, distinct between teams) laid over it at `alpha` (default 0.4),
   * with black or white text, whichever reads better on the fill. A row whose team is not found keeps the theme.
   */
  teamRows?: {
    key: keyof Row & string;
    league: League;
    /** "primary" (default) or "secondary". */
    which?: Which;
    /** The fill's opacity over the theme's background, 0 to 1. Default 0.4 (as the `teamColorBg` column). */
    alpha?: number;
    season?: SeasonInput;
    idSystem?: IdSystem;
  };
}

// MUI's base row height and its density factors (@mui/x-data-grid 9.15 densitySelector)
const MUI_ROW_HEIGHT = 52;
const DENSITY = { compact: "compact", comfortable: "standard", social: "comfortable" } as const;
const FACTOR = { compact: 0.7, standard: 1, comfortable: 1.3 } as const;
const MUI: GridName = {
  fn: "dataGridProps",
  ns: "mui",
  grid: "MUI X Data Grid",
  short: "MUI",
  built: "props",
};
const fillClass = (fill: string): string => `sdvt-fill-${fill.slice(1)}`;

function image(src: string, alt: string, height: number, id: string, kind: string): ReactElement {
  return createElement("img", {
    src,
    alt,
    height,
    style: { height: `${height}px`, width: "auto" },
    "data-sdv-id": id,
    "data-sdv-kind": kind,
  });
}
/**
 * An sdvtables spec as MUI X Data Grid props: `<DataGrid rows={rows} {...dataGridProps(spec, rows)} />`.
 *
 * - **Columns**: one `GridColDef` per spec column, with the HTML table's label, alignment and px `width`; numbers
 *   (`num`, `int`, `pct`, `rank`) keep sdvtables' formats and sort as numbers.
 * - **Images**: `logo`, `wordmark` and `headshot` columns draw `<img>` cells `height` px tall. A team or player with no
 *   image keeps its text, with one warning. Team values may be abbreviations, names or numeric ids.
 * - **Team colours**: `teamColorBg` and `teamColorBar` columns, and whole rows with `teamRows`, take sdvplot's team
 *   palette for the theme's background, with black or white text by contrast.
 * - **Theme**: the theme's fonts, colours, header style, rules and stripes as the grid's `sx`, its density as MUI's.
 *
 * Other column kinds (pills, bars, sparklines...) show their plain value, with one warning per kind. Synchronous: call
 * `await prepare(spec)` (`@sportsdataverse/sdvtables/html`) first. Images and colours are worked out once, from
 * `rows`: build the props again (or `useMemo` on `rows`) when the rows change. MIT `@mui/x-data-grid` only: nothing
 * here needs the Pro or Premium packages.
 *
 * @example
 * ```tsx
 * import { DataGrid } from "@mui/x-data-grid";
 * import { defineTable } from "@sportsdataverse/sdvtables";
 * import { prepare } from "@sportsdataverse/sdvtables/html";
 * import { dataGridProps } from "@sportsdataverse/sdvtables/mui";
 *
 * // 2024 regular season, nflverse games
 * const rows = [
 *   { team: "KC", wins: 15, pf: 385, pa: 326 },
 *   { team: "BUF", wins: 13, pf: 525, pa: 368 },
 *   { team: "LAC", wins: 11, pf: 402, pa: 301 },
 * ];
 * const spec = defineTable<(typeof rows)[number]>()
 *   .columns((c) => [c.logo("team", { league: "nfl", height: 28 }), c.int("wins"), c.int("pf"), c.int("pa")])
 *   .theme("sdv")
 *   .rowKey("team")
 *   .build();
 * await prepare(spec);
 * <DataGrid rows={rows} {...dataGridProps(spec, rows, { teamRows: { key: "team", league: "nfl" } })} />;
 * ```
 */
export function dataGridProps<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  o: DataGridPropsOptions<Row> = {},
): SdvDataGridProps<Row> {
  const theme = resolveTheme(spec.theme);
  const t = theme.tokens;
  const bg = opaque(t);
  const fills = new Map<string, Fill>(); // class -> colours, written into sx
  const bars = new Map<string, { width: number; color: string }>();
  let tallest = 0;
  const { scaled, labelSuffix } = scaleNotes(spec);

  const columns = spec.columns.map((col): SdvGridColDef<Row> => {
    const align = alignOf(col);
    const sortBy = missingLast(col, rows);
    const def: SdvGridColDef<Row> = {
      field: col.key,
      headerName: labelOf(col) + (labelSuffix.get(col.key) ?? ""),
      getSortComparator: (dir) => (dir === "asc" || dir === "desc" ? sortBy(dir) : undefined),
      align,
      headerAlign: align,
      ...(col.subheader === undefined ? {} : { description: col.subheader }),
      ...(col.sortable === undefined ? {} : { sortable: col.sortable }),
      ...(col.filterable === undefined ? {} : { filterable: col.filterable }),
      ...(NUMERIC_KINDS.has(col.kind)
        ? { type: "number" as const, valueGetter: (v: never) => toNumber(v) }
        : {}),
    };
    const width = pxWidth(col, MUI);
    if (width !== undefined) def.width = width;
    const format = formatterFor(col, scaled);
    return { ...def, ...(format === undefined ? {} : { valueFormatter: format }), ...kindProps(col) };
  });

  function kindProps(col: ColumnSpec<Row>): Partial<SdvGridColDef<Row>> {
    switch (col.kind) {
      case "text":
      case "num":
      case "int":
      case "pct":
        return {};
      case "rank":
        return col.superscript
          ? {
              // the HTML table's superscript suffix: 1<sup>st</sup>
              renderCell: ({ value: v }: GridCellParamsLike<Row>) => {
                const r = rankParts(v);
                if (r === null) return "";
                const sup = createElement("sup", { style: { fontSize: col.suffixSize } }, r.suffix);
                return createElement(Fragment, null, r.num, sup);
              },
            }
          : {};
      case "logo":
      case "wordmark": {
        const h = checkHeight(col.height, col.kind);
        tallest = Math.max(tallest, h);
        const marks = logoMarks(col, rows);
        const includeName = col.kind === "logo" && col.includeName;
        const kind = col.kind;
        return {
          display: "flex",
          renderCell: ({ value: raw }) => {
            const text = cell(raw);
            const m = marks.get(text);
            if (m === undefined) return text; // blank, unknown team or no image: the text, as the HTML table keeps it
            const img = image(m.url, teamNameSync(col.league, m.id) ?? text, h, m.id, kind);
            return includeName
              ? createElement(
                  "span",
                  { style: { display: "inline-flex", alignItems: "center", gap: "0.4em" } },
                  img,
                  text,
                )
              : img;
          },
        };
      }
      case "headshot": {
        const h = checkHeight(col.height, "headshot");
        tallest = Math.max(tallest, h);
        const urls = headshotUrls(col, rows, MUI);
        return {
          display: "flex",
          renderCell: ({ value: raw }) => {
            const text = cell(raw);
            const url = urls.get(text);
            // decorative: the spec gives a headshot no name, and the player's name sits in its row
            return url === undefined ? text : image(url, "", h, text, "headshot");
          },
        };
      }
      case "teamColorBg":
      case "teamColorBar": {
        const colorOf = teamColorOf(col, rows, bg, teamColorPalette);
        const classOf = (raw: unknown): string => {
          const color = colorOf(raw);
          if (col.kind === "teamColorBar") {
            const c = hex6(color, { dropAlpha: true });
            const name = `sdvt-bar-${col.barWidth}-${c.slice(1)}`;
            bars.set(name, { width: col.barWidth, color: c });
            return name;
          }
          const f = tint(color, col.alpha, bg);
          fills.set(fillClass(f.fill), f);
          return fillClass(f.fill);
        };
        // ponytail: every row's class is worked out now, so the sx below already holds each one's rule
        for (const r of rows) classOf(value(r, col.key));
        return { cellClassName: ({ value: raw }) => classOf(raw) };
      }
      default:
        unmapped(col.kind, MUI);
        return {};
    }
  }

  // team rows: each row's class by its team's fill
  const rowFill = new Map<string, string>();
  if (o.teamRows)
    for (const [v, f] of teamRowFills(rows, o.teamRows, bg, teamColorPalette)) {
      fills.set(fillClass(f.fill), f);
      rowFill.set(v, fillClass(f.fill));
    }
  const striped = t.stripe !== "transparent";
  const getRowClassName = ({ row, indexRelativeToCurrentPage }: GridRowClassParamsLike<Row>): string => {
    const team = o.teamRows === undefined ? undefined : rowFill.get(cell(value(row, o.teamRows.key)));
    return team ?? (striped && indexRelativeToCurrentPage % 2 === 1 ? "sdvt-stripe" : "");
  };

  const getRowId = rowIds(rows, spec.rowKey, MUI);
  const density = DENSITY[spec.theme.density];
  const rowHeight = Math.max(MUI_ROW_HEIGHT, Math.ceil((tallest + 8) / FACTOR[density]));
  return { columns, getRowId, getRowClassName, sx: themeSx(t, fills, bars), density, rowHeight };
}

/** The theme's tokens as MUI X Data Grid styles: its CSS variables (on `&&`, so they beat MUI's own) and header rules. */
function themeSx(
  t: ThemeTokens,
  fills: ReadonlyMap<string, { fill: string; ink: string }>,
  bars: ReadonlyMap<string, { width: number; color: string }>,
): GridSx {
  const set = (v: string): boolean => v !== "transparent" && v !== "inherit" && v !== "none";
  const bg = set(t.bg) ? t.bg : undefined;
  const head = set(t.labelBg) ? t.labelBg : bg;
  const vars: Record<string, string> = {
    "--DataGrid-t-color-foreground-base": t.text,
    "--DataGrid-t-color-foreground-muted": t.muted,
    "--DataGrid-t-color-border-base": t.rule,
    "--DataGrid-t-typography-font-family-base": t.fontBody,
    "--DataGrid-t-typography-font-body": `${t.bodyWeight} ${t.bodySize} ${t.fontBody}`,
    ...(bg === undefined
      ? {}
      : { "--DataGrid-t-color-background-base": bg, "--DataGrid-t-cell-background-pinned": bg }),
    ...(head === undefined ? {} : { "--DataGrid-t-header-background-base": head }),
  };
  const sx: Record<string, GridSx> = {
    "&&": vars,
    // MUI's material pieces (pager, icon buttons) read the MUI theme, not the grid's variables: give them the ink
    "& .MuiTablePagination-root, & .MuiIconButton-root": { color: "inherit" },
    "& .MuiDataGrid-columnHeaderTitle": {
      fontFamily: t.fontLabel,
      fontWeight: t.labelWeight,
      fontSize: t.labelSize,
      fontStyle: t.labelStyle,
      textTransform: t.labelTransform,
      letterSpacing: t.labelTracking,
    },
    ...(set(t.labelColor) ? { "& .MuiDataGrid-columnHeader": { color: t.labelColor } } : {}),
    ...(t.stripe === "transparent"
      ? {}
      : { "& .MuiDataGrid-row.sdvt-stripe": { backgroundColor: t.stripe } }),
  };
  for (const [name, f] of fills) {
    sx[`& .${name}`] = { backgroundColor: f.fill, color: f.ink };
    // MUI's row :hover and .Mui-selected rules outrank the class above: keep a shade of the fill, its ink recomputed
    const shade = (t: number): GridSx => {
      const c = mix(f.fill, f.ink, t);
      return { backgroundColor: c, color: onColor(c) };
    };
    sx[`& .MuiDataGrid-row.${name}:hover`] = shade(0.06);
    sx[`& .MuiDataGrid-row.${name}.Mui-selected`] = shade(0.1);
    sx[`& .MuiDataGrid-row.${name}.Mui-selected:hover`] = shade(0.14);
  }
  for (const [name, b] of bars)
    sx[`& .MuiDataGrid-cell.${name}`] = { borderLeft: `${b.width}px solid ${b.color}` };
  return sx;
}
