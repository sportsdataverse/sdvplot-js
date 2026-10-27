/**
 * The AG Grid adapter (`ag-grid-community` 36, the MIT community package only): an sdvtables spec as the grid options
 * `createGrid(el, options)` (or `<AgGridReact {...options} />`) takes. Columns keep sdvtables' number formats,
 * alignment, px widths and sort; logo, wordmark and headshot columns draw their images through cell renderers that
 * work in plain JavaScript and in ag-grid-react alike; team-coloured rows and cells take sdvplot's team palette with
 * black or white text by contrast, kept through AG Grid's hover and selection; the theme's tokens become an AG Grid
 * theme through its Theming API, from the base theme the caller passes in.
 * Pure: AG Grid is never imported at runtime (types only), and nothing touches the DOM until AG Grid renders a cell, so
 * the module imports on a server.
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
import { teamColorPalette } from "@sportsdataverse/sdvplot/tanstack";
import type {
  CellStyle,
  ColDef,
  GetRowIdParams,
  HeaderStyle,
  ICellRendererComp,
  ICellRendererParams,
  RowClassParams,
  RowStyle,
  Theme,
  ThemeDefaultParams,
} from "ag-grid-community";
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
import type { ColumnSpec, TableSpec } from "./spec.js";
import { teamNameSync } from "./team-name.js";
import { resolveTheme } from "./themes/index.js";
import type { ThemeTokens } from "./themes/tokens.js";

/** What `gridOptions` returns: pass it to `createGrid(el, options)`, or spread it onto `<AgGridReact />`. */
export interface SdvGridOptions<Row> {
  /** One column per spec column. */
  columnDefs: ColDef<Row>[];
  /** The rows, in their order. */
  rowData: Row[];
  /** `String(row[spec.rowKey])`, else the row's index in `rows`; checked unique and not blank when built. */
  getRowId: (params: GetRowIdParams<Row>) => string;
  /** A team row's fill, text colour and hover and selected shades (`teamRows`); other rows keep the theme. */
  getRowStyle: (params: RowClassParams<Row>) => RowStyle | undefined;
  /** The theme's density as a row height in px, tall enough for the tallest image. */
  rowHeight: number;
  /** The theme as AG Grid theme params over the `theme` option's base; absent without that option. */
  theme?: Theme<ThemeDefaultParams>;
}
/** `gridOptions` options. */
export interface GridOptionsOptions<Row> {
  /**
   * The AG Grid base theme to lay the sdvtables theme over, usually `themeQuartz` from `ag-grid-community` (or
   * `themeAlpine`, `themeBalham`). Passed in so this module never imports AG Grid. Without it, no `theme` is returned
   * and the grid keeps its own.
   */
  theme?: Theme<ThemeDefaultParams>;
  /**
   * Fill each row with its team's colour, from the row's `key` value (an abbreviation, a name or a numeric id).
   * The colours are sdvplot's team palette for the theme's background (3:1 against it, distinct between teams) laid
   * over it at `alpha` (default 0.4), with black or white text, whichever reads better on the fill. A row whose team
   * is not found keeps the theme.
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

// a row height per density: compact, AG Grid Quartz's own (42), and a roomier one for social cards
const ROW_HEIGHT = { compact: 32, comfortable: 42, social: 52 } as const;
// how far a team row's hover and selected shades move away from its text colour (so the text only gains contrast)
const HOVER = 0.08;
const SELECTED = 0.16;

const AG: GridName = {
  fn: "gridOptions",
  ns: "aggrid",
  grid: "AG Grid",
  short: "AG Grid",
  built: "options",
};
/** A fill moved `t` away from its ink: lighter under black text, darker under white, so the text reads at least as well. */
const shade = (f: Fill, t: number): string => mix(f.fill, f.ink === "#000000" ? "#ffffff" : "#000000", t);

/**
 * An AG Grid cell renderer class whose cell is `draw(params)`: a DOM node, or text. A class with `getGui` because
 * ag-grid-react renders a plain function as a React component; a class is a plain-JavaScript component in both.
 */
function rendererOf(
  draw: (p: ICellRendererParams, doc: Document) => Node | string,
): new () => ICellRendererComp {
  return class SdvCell implements ICellRendererComp {
    private gui: HTMLElement | undefined;
    init(p: ICellRendererParams): void {
      const doc = p.eGridCell?.ownerDocument ?? document;
      const gui = doc.createElement("span");
      gui.style.display = "inline-flex";
      gui.style.alignItems = "center";
      gui.style.gap = "0.4em";
      gui.append(draw(p, doc));
      this.gui = gui;
    }
    getGui(): HTMLElement {
      return this.gui as HTMLElement;
    }
    refresh(): boolean {
      return false; // AG Grid builds the cell again
    }
  };
}
function image(
  doc: Document,
  src: string,
  alt: string,
  height: number,
  id: string,
  kind: string,
): HTMLImageElement {
  const img = doc.createElement("img");
  img.src = src;
  img.alt = alt;
  img.height = height;
  img.style.height = `${height}px`;
  img.style.width = "auto";
  img.dataset.sdvId = id;
  img.dataset.sdvKind = kind;
  return img;
}

/**
 * An sdvtables spec as AG Grid options: `createGrid(el, gridOptions(spec, rows, { theme: themeQuartz }))`, or
 * `<AgGridReact {...gridOptions(spec, rows, { theme: themeQuartz })} />`.
 *
 * - **Columns**: one `ColDef` per spec column, with the HTML table's label, alignment and px `width`; numbers (`num`,
 *   `int`, `pct`, `rank`, and a `scaleNote`'s divisor and label suffix) keep sdvtables' formats, filter as numbers, and
 *   sort with sdvtables' own comparator, missing values last both ways (a blank number is missing, never 0).
 * - **Images**: `logo`, `wordmark` and `headshot` columns draw `<img>` cells `height` px tall, in plain JavaScript and
 *   in ag-grid-react alike. A team or player with no image keeps its text, with one warning. Team values may be
 *   abbreviations, names or numeric ids.
 * - **Team colours**: `teamColorBg` and `teamColorBar` columns, and whole rows with `teamRows`, take sdvplot's team
 *   palette for the theme's background, with black or white text by contrast; a team row keeps a shade of its fill
 *   when AG Grid hovers or selects it.
 * - **Theme**: with `theme` (AG Grid's `themeQuartz`, say), the theme's fonts, colours, header style, rules, stripes and
 *   colour scheme as AG Grid theme params; its density as the row height.
 *
 * Other column kinds (pills, bars, sparklines...) show their plain value, with one warning per kind. Synchronous: call
 * `await prepare(spec)` (`@sportsdataverse/sdvtables/html`) first. Images and colours are worked out once, from
 * `rows`: build the options again when the rows change. Community features only (MIT `ag-grid-community`):
 * register `AllCommunityModule`; nothing here needs AG Grid Enterprise.
 *
 * @example
 * ```ts
 * import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
 * import { defineTable } from "@sportsdataverse/sdvtables";
 * import { gridOptions } from "@sportsdataverse/sdvtables/aggrid";
 * import { prepare } from "@sportsdataverse/sdvtables/html";
 *
 * ModuleRegistry.registerModules([AllCommunityModule]);
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
 * const options = gridOptions(spec, rows, { theme: themeQuartz, teamRows: { key: "team", league: "nfl" } });
 * // in the page: createGrid(document.querySelector("#grid"), options), from ag-grid-community
 * options.columnDefs.map((c) => [c.headerName, c.cellDataType]);
 * ```
 */
export function gridOptions<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  o: GridOptionsOptions<Row> = {},
): SdvGridOptions<Row> {
  const t = resolveTheme(spec.theme).tokens;
  const bg = opaque(t);
  let tallest = 0;
  const { scaled, labelSuffix } = scaleNotes(spec);
  const header = headerStyle(t);

  const columnDefs = spec.columns.map((col): ColDef<Row> => {
    const align = alignOf(col);
    const sortBy = missingLast(col, rows);
    const numeric = NUMERIC_KINDS.has(col.kind);
    const def: ColDef<Row> = {
      colId: col.key,
      field: col.key as unknown as NonNullable<ColDef<Row>["field"]>,
      headerName: labelOf(col) + (labelSuffix.get(col.key) ?? ""),
      // AG Grid's docs (colDef.d.ts: `isDescending` is "not to be used for inverting the return value") assume a
      // comparator that orders ascending, which the grid then reverses (RowNodeSorter: `descending ? -result : result`).
      // Ours is not that: withMissingLast(cmp, "desc") already orders descending AND puts missing values last, and
      // reversing it would put them first. So it is negated here, and the grid's own negation undoes that: the final
      // order is exactly withMissingLast's, both ways. Do not drop the negation: test/dom/aggrid.test.ts "sorting" sorts
      // a real grid both ways and fails without it (a blank value goes first when descending).
      comparator: (a, b, _na, _nb, desc) => {
        const r = sortBy(desc ? "desc" : "asc")(a, b);
        return desc ? -r : r;
      },
      cellStyle: { textAlign: align },
      ...(align === "right" ? { headerClass: "ag-right-aligned-header" } : {}),
      ...(header === undefined ? {} : { headerStyle: header }),
      ...(col.subheader === undefined ? {} : { headerTooltip: col.subheader }),
      ...(col.sortable === undefined ? {} : { sortable: col.sortable }),
      ...(col.filterable === undefined ? {} : { filter: col.filterable }),
      ...(numeric
        ? {
            cellDataType: "number", // with filtering on, AG Grid gives the column its number filter
            valueGetter: (p) => toNumber(value(p.data, col.key)),
          }
        : { cellDataType: false }),
    };
    const width = pxWidth(col, AG);
    if (width !== undefined) def.width = width;
    const format = formatterFor(col, scaled);
    return {
      ...def,
      ...(format === undefined ? {} : { valueFormatter: ({ value: v }) => format(v) }),
      ...kindProps(col, def.cellStyle as CellStyle),
    };
  });

  function kindProps(col: ColumnSpec<Row>, base: CellStyle): Partial<ColDef<Row>> {
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
              cellRenderer: rendererOf(({ value: v }, doc) => {
                const r = rankParts(v);
                if (r === null) return "";
                const out = doc.createDocumentFragment();
                const sup = doc.createElement("sup");
                sup.style.fontSize = col.suffixSize;
                sup.textContent = r.suffix;
                out.append(r.num, sup);
                return out;
              }),
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
          cellRenderer: rendererOf(({ value: raw }, doc) => {
            const text = cell(raw);
            const m = marks.get(text);
            if (m === undefined) return text; // blank, unknown team or no image: the text, as the HTML table keeps it
            const img = image(doc, m.url, teamNameSync(col.league, m.id) ?? text, h, m.id, kind);
            if (!includeName) return img;
            const both = doc.createDocumentFragment();
            both.append(img, text);
            return both;
          }),
        };
      }
      case "headshot": {
        const h = checkHeight(col.height, "headshot");
        tallest = Math.max(tallest, h);
        const urls = headshotUrls(col, rows, AG);
        return {
          cellRenderer: rendererOf(({ value: raw }, doc) => {
            const text = cell(raw);
            const url = urls.get(text);
            // decorative: the spec gives a headshot no name, and the player's name sits in its row
            return url === undefined ? text : image(doc, url, "", h, text, "headshot");
          }),
        };
      }
      case "teamColorBg":
      case "teamColorBar": {
        const colorOf = teamColorOf(col, rows, bg, teamColorPalette);
        const bar = col.kind === "teamColorBar";
        const styleOf = (raw: unknown): CellStyle => {
          const color = colorOf(raw);
          if (bar)
            return {
              ...base,
              borderLeft: `${col.barWidth}px solid ${hex6(color, { dropAlpha: true })}`,
            };
          const f = tint(color, col.alpha, bg);
          return { ...base, backgroundColor: f.fill, color: f.ink };
        };
        return { cellStyle: ({ value: raw }) => styleOf(raw) };
      }
      default:
        unmapped(col.kind, AG);
        return {};
    }
  }

  // team rows: each team value's fill, ink and hover / selected shades, worked out once
  const rowFill = new Map<string, RowStyle>();
  if (o.teamRows)
    for (const [v, f] of teamRowFills(rows, o.teamRows, bg, teamColorPalette))
      rowFill.set(v, {
        backgroundColor: f.fill,
        color: f.ink,
        // AG Grid's own row variables, read on this row: the filler after the last column, and the hover and
        // selected overlays it paints over the row (opaque shades of the fill, so the ink above still reads)
        "--ag-data-background-color": f.fill,
        "--ag-row-hover-color": shade(f, HOVER),
        "--ag-selected-row-background-color": shade(f, SELECTED),
      } as RowStyle);
  const teamKey = o.teamRows?.key;
  const getRowStyle = ({ data }: RowClassParams<Row>): RowStyle | undefined =>
    teamKey === undefined ? undefined : rowFill.get(cell(value(data, teamKey)));

  // every row's id, checked once: a repeat would give AG Grid one id twice, and it would drop a row
  const idOf = rowIds(rows, spec.rowKey, AG);
  const getRowId = ({ data }: GetRowIdParams<Row>): string => idOf(data);

  const rowHeight = Math.max(ROW_HEIGHT[spec.theme.density], Math.ceil(tallest + 8));
  return {
    columnDefs,
    rowData: rows.slice(),
    getRowId,
    getRowStyle,
    rowHeight,
    ...(o.theme === undefined ? {} : { theme: o.theme.withParams(themeParams(t)) }),
  };
}

const set = (v: string): boolean => v !== "transparent" && v !== "inherit" && v !== "none" && v !== "";

/** The header text style AG Grid has no theme param for: case, tracking and italics. */
function headerStyle(t: ThemeTokens): HeaderStyle | undefined {
  const s: HeaderStyle = {
    ...(set(t.labelTransform) ? { textTransform: t.labelTransform } : {}),
    ...(set(t.labelTracking) && t.labelTracking !== "normal" ? { letterSpacing: t.labelTracking } : {}),
    ...(set(t.labelStyle) && t.labelStyle !== "normal" ? { fontStyle: t.labelStyle } : {}),
  };
  return Object.keys(s).length === 0 ? undefined : s;
}

/** The theme's tokens as AG Grid theme params (Theming API), for `base.withParams(...)`. */
function themeParams(t: ThemeTokens): Partial<ThemeDefaultParams> {
  const bg = opaque(t);
  const head = set(t.labelBg) ? t.labelBg : bg;
  return {
    backgroundColor: bg,
    foregroundColor: t.text,
    textColor: t.text,
    cellTextColor: t.text,
    subtleTextColor: t.muted,
    borderColor: t.rule,
    ...(set(t.accent) ? { accentColor: t.accent } : {}),
    headerBackgroundColor: head,
    headerTextColor: set(t.labelColor) ? t.labelColor : t.text,
    headerFontFamily: t.fontLabel,
    headerFontWeight: t.labelWeight as ThemeDefaultParams["headerFontWeight"],
    headerFontSize: t.labelSize,
    fontFamily: t.fontBody,
    fontSize: t.bodySize,
    cellFontWeight: t.bodyWeight as ThemeDefaultParams["cellFontWeight"],
    oddRowBackgroundColor: set(t.stripe) ? t.stripe : bg,
    // dark themes get AG Grid's dark scrollbars and form controls
    browserColorScheme: onColor(bg) === "#ffffff" ? "dark" : "light",
  };
}
