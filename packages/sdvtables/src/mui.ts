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
  checkAlpha,
  headshotUrl,
  hex6,
  logoUrlSync,
  onColor,
  resolveSync,
  solid,
  warn,
} from "@sportsdataverse/sdvplot";
import { teamColorPalette } from "@sportsdataverse/sdvplot/mui";
import { type ReactElement, createElement } from "react";
import { NUMERIC_KINDS } from "./engine.js";
import { TableSpecError } from "./errors.js";
import { formatNumber, isBlank, ordinal, toNumber } from "./format.js";
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
  /** The cell's text through sdvtables' number formats. */
  valueFormatter?: (value: never) => string;
  /** A logo, wordmark or headshot image. */
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
  /** `String(row[spec.rowKey])`, else the row's index in `rows`. */
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
const SUPPORTED = new Set<string>([
  "text",
  "num",
  "int",
  "pct",
  "rank",
  "logo",
  "wordmark",
  "headshot",
  "teamColorBg",
  "teamColorBar",
]);

const cell = (v: unknown): string => (isBlank(v) ? "" : String(v).trim());
const value = (row: unknown, key: string): unknown => (row as Record<string, unknown>)[key];
const fillClass = (fill: string): string => `sdvt-fill-${fill.slice(1)}`;
const opaque = (t: ThemeTokens): string => (t.bg === "transparent" ? "#ffffff" : hex6(t.bg));
const alphaHex = (a: number): string =>
  Math.round(checkAlpha(a) * 255)
    .toString(16)
    .padStart(2, "0");
/** `fill` over `bg` at `alpha`, opaque, with its readable text colour. */
const tint = (color: string, alpha: number, bg: string): { fill: string; ink: string } => {
  const fill = solid(`${hex6(color, { dropAlpha: true })}${alphaHex(alpha)}`, bg);
  return { fill, ink: onColor(fill) };
};

/** Each distinct cell value of `key` (trimmed text) -> its team id, by ONE resolveSync over the rows (one warning). */
function teamIds(
  rows: readonly unknown[],
  key: string,
  league: League,
  o: { season?: SeasonInput | undefined; idSystem?: IdSystem | undefined; strict?: boolean | undefined },
): Map<string, string> {
  const raw = [...new Set(rows.map((r) => cell(value(r, key))).filter((v) => v !== ""))];
  const ids = resolveSync(raw, league, {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
    strict: o.strict ?? false,
  });
  const out = new Map<string, string>();
  raw.forEach((v, i) => {
    const id = ids[i];
    if (id !== undefined) out.set(v, id);
  });
  return out;
}
/** Each team id -> its palette colour for `bg` (sdvplot/mui's `teamColorPalette`, not a fork of it). */
function palette(
  league: League,
  ids: readonly string[],
  which: Which | undefined,
  bg: string,
): Map<string, string> {
  const colors = teamColorPalette(league, ids, {
    idSystem: "team_id",
    background: bg,
    ...(which === undefined ? {} : { which }),
  });
  return new Map(ids.map((id, i) => [id, colors[i] ?? "#808080"]));
}

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
function checkHeight(h: number, kind: string): number {
  if (!(Number.isFinite(h) && h >= 1))
    throw new TableSpecError(`${kind} height must be a number of pixels >= 1, got ${String(h)}`);
  return h;
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
  const fills = new Map<string, { fill: string; ink: string }>(); // class -> colours, written into sx
  const bars = new Map<string, { width: number; color: string }>();
  let tallest = 0;

  const columns = spec.columns.map((col): SdvGridColDef<Row> => {
    const align = alignOf(col);
    const def: SdvGridColDef<Row> = {
      field: col.key,
      headerName: labelOf(col),
      align,
      headerAlign: align,
      ...(col.subheader === undefined ? {} : { description: col.subheader }),
      ...(col.sortable === undefined ? {} : { sortable: col.sortable }),
      ...(col.filterable === undefined ? {} : { filterable: col.filterable }),
      ...(NUMERIC_KINDS.has(col.kind) ? { type: "number" as const } : {}),
    };
    if (col.width !== undefined) {
      const m = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(col.width);
      if (m) def.width = Number(m[1]);
      else
        warn(
          `sdvtables:mui:width:${col.key}`,
          `dataGridProps: column "${col.key}" width ${JSON.stringify(col.width)} is not in px; MUI X Data Grid widths are px numbers, so MUI's default is kept`,
        );
    }
    return { ...def, ...kindProps(col) };
  });

  function kindProps(col: ColumnSpec<Row>): Partial<SdvGridColDef<Row>> {
    switch (col.kind) {
      case "text":
        return {};
      case "num":
        return {
          valueFormatter: numberFormat((n) =>
            formatNumber(n, {
              ...(col.digits === undefined ? {} : { digits: col.digits }),
              big: col.big ?? false,
              prefix: col.prefix ?? "",
              suffix: col.suffix ?? "",
              forceSign: col.forceSign ?? false,
            }),
          ),
        };
      case "int":
        return { valueFormatter: numberFormat((n) => formatNumber(n, { digits: 0, big: true })) };
      case "pct":
        return {
          valueFormatter: numberFormat(
            (n) => `${formatNumber(col.scale ? n * 100 : n, { digits: col.digits })}%`,
          ),
        };
      case "rank":
        return { valueFormatter: numberFormat(ordinal) };
      case "logo":
      case "wordmark": {
        const h = checkHeight(col.height, col.kind);
        tallest = Math.max(tallest, h);
        const marks = new Map<string, { id: string; url: string }>();
        for (const [v, id] of teamIds(rows, col.key, col.league, col)) {
          const url = logoUrlSync(id, col.league, {
            ...(col.season === undefined ? {} : { season: col.season }),
            ...(col.variant === undefined ? {} : { variant: col.variant }),
            markType: col.kind,
            idSystem: "team_id",
          }); // undefined: no mark archived, and sdvplot warned once
          if (url !== undefined) marks.set(v, { id, url });
        }
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
        const urls = new Map<string, string>();
        for (const v of new Set(rows.map((r) => cell(value(r, col.key))))) {
          if (v === "") continue;
          const url = headshotUrl(v, col.league, { idSystem: col.idSystem });
          if (url === undefined)
            warn(
              `sdvtables:mui:headshot:${col.league}:${v}`,
              `dataGridProps: no ${col.league} headshot for player ${JSON.stringify(v)}: the cell keeps the id`,
            );
          else urls.set(v, url);
        }
        return {
          display: "flex",
          renderCell: ({ value: raw }) => {
            const text = cell(raw);
            const url = urls.get(text);
            return url === undefined ? text : image(url, text, h, text, "headshot");
          },
        };
      }
      case "teamColorBg":
      case "teamColorBar": {
        const ids = teamIds(rows, col.key, col.league, col);
        const colors = palette(col.league, [...new Set(ids.values())], col.which, bg);
        const classOf = (raw: unknown): string => {
          const id = ids.get(cell(raw));
          const color = (id === undefined ? undefined : colors.get(id)) ?? col.naColor;
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
        warn(
          `sdvtables:mui:kind:${col.kind}`,
          `dataGridProps: MUI X Data Grid cells for "${col.kind}" columns are not mapped yet; they show the plain value`,
        );
        return {};
    }
  }

  // team rows: each row's class by its team's fill
  const rowFill = new Map<string, string>();
  if (o.teamRows) {
    const tr = o.teamRows;
    const alpha = tr.alpha ?? 0.4;
    const ids = teamIds(rows, tr.key, tr.league, tr);
    const colors = palette(tr.league, [...new Set(ids.values())], tr.which, bg);
    for (const [v, id] of ids) {
      const color = colors.get(id);
      if (color === undefined) continue;
      const f = tint(color, alpha, bg);
      fills.set(fillClass(f.fill), f);
      rowFill.set(v, fillClass(f.fill));
    }
  }
  const striped = t.stripe !== "transparent";
  const getRowClassName = ({ row, indexRelativeToCurrentPage }: GridRowClassParamsLike<Row>): string => {
    const team = o.teamRows === undefined ? undefined : rowFill.get(cell(value(row, o.teamRows.key)));
    return team ?? (striped && indexRelativeToCurrentPage % 2 === 1 ? "sdvt-stripe" : "");
  };

  const index = new Map(rows.map((r, i) => [r, i] as const));
  const key = spec.rowKey;
  const getRowId = (row: Row): string => {
    if (key !== undefined) return String(value(row, key));
    const i = index.get(row);
    if (i === undefined)
      throw new TableSpecError(
        "dataGridProps: a row the props were not built from has no id; set the spec's rowKey, or build the props from the rows you pass the grid",
      );
    return String(i);
  };

  const density = DENSITY[spec.theme.density];
  const rowHeight = Math.max(MUI_ROW_HEIGHT, Math.ceil((tallest + 8) / FACTOR[density]));
  return { columns, getRowId, getRowClassName, sx: themeSx(t, fills, bars), density, rowHeight };
}

const numberFormat =
  (f: (n: number) => string) =>
  (v: never): string => {
    const n = toNumber(v);
    return n === null ? "" : f(n);
  };

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
  for (const [name, f] of fills) sx[`& .${name}`] = { backgroundColor: f.fill, color: f.ink };
  for (const [name, b] of bars)
    sx[`& .MuiDataGrid-cell.${name}`] = { borderLeft: `${b.width}px solid ${b.color}` };
  return sx;
}
