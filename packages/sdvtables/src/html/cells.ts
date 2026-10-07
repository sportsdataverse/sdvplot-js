// src/html/cells.ts — Task 5 version: the context types + dispatcher + text; Tasks 6–8 add the other kinds in this file
import { TableSpecError } from "../errors.js";
import { formatNumber, isBlank, naturalDigits, ordinal, toNumber } from "../format.js";
import type { ColumnSpec, TableSpec } from "../spec.js";
import type { Theme } from "../themes/tokens.js";
import { escapeAttr, escapeHtml } from "./escape.js";
/** One scaled column (pills, ranks, percentile), computed once per column by Task 8's columnScales. */
export interface ColumnScale {
  readonly domain: readonly [number, number];
  readonly palette: readonly string[];
  readonly reverse: boolean;
  readonly values: readonly (number | null)[];
  readonly color: (v: number) => string | null;
}
/** Decided once here; Tasks 7, 8 and 10 fill the maps (index.ts passes them empty until then). */
export interface RenderContext<Row> {
  readonly spec: TableSpec<Row>;
  readonly rows: readonly Row[];
  readonly theme: Theme;
  readonly id: string;
  readonly sel: string;
  readonly columns: readonly ColumnSpec<Row>[];
  readonly groupKey: string | undefined;
  readonly warn: (key: string, message: string) => void;
  /** Task 7: team ids per team column, ONE resolveSync per column (J28), keyed by the column key. */
  readonly teamIds: ReadonlyMap<string, readonly (string | undefined)[]>;
  /** Task 8: scales per pills/ranks/percentile column, keyed by column key. */
  readonly scales: ReadonlyMap<string, ColumnScale>;
  /** Task 8: the last scale in column order — what gt_legend_continuous reads back as `_sdvplot_scale`. */
  readonly recorded: ColumnScale | undefined;
  /** Task 10: scaleNote divisor + decimals per num/int column; applyDecorations fills it before the row loop. */
  readonly scaled: Map<string, { readonly divisor: number; readonly decimals: number }>;
}
export const cellValue = <Row>(row: Row, key: string): unknown => (row as Record<string, unknown>)[key];
export function renderCell<Row>(col: ColumnSpec<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  switch (col.kind) {
    case "text":
      return escapeHtml(cellValue(row, col.key));
    // ---- Task 6
    case "num":
    case "int": {
      const n = toNumber(cellValue(row, col.key));
      if (n === null) return "";
      const sc = ctx.scaled.get(col.key); // scaleNote (Task 10): Python fmt_number(scale_by = 1/divisor, decimals) replaces the column's own format
      if (sc) return escapeHtml(formatNumber(n / sc.divisor, { digits: sc.decimals, big: true }));
      return escapeHtml(
        col.kind === "int"
          ? formatNumber(Math.round(n), { digits: 0, big: true })
          : formatNumber(n, {
              ...(col.digits !== undefined ? { digits: col.digits } : {}),
              big: col.big ?? false,
              prefix: col.prefix ?? "",
              suffix: col.suffix ?? "",
              forceSign: col.forceSign ?? false,
            }),
      );
    }
    case "pct": {
      const n = toNumber(cellValue(row, col.key));
      return n === null
        ? ""
        : escapeHtml(`${formatNumber(col.scale ? n * 100 : n, { digits: col.digits })}%`);
    }
    case "rank": {
      const n = toNumber(cellValue(row, col.key));
      if (n === null) return "";
      const o = ordinal(n);
      const num = String(Math.trunc(n));
      return col.superscript
        ? `${num}<sup style="font-size:${escapeAttr(col.suffixSize)}">${o.slice(num.length)}</sup>`
        : escapeHtml(o);
    }
    case "delta": {
      const a = toNumber(cellValue(row, col.key));
      const b = toNumber(cellValue(row, col.to));
      if (a === null || b === null) return "";
      const d = col.percent ? (a === 0 ? null : (b - a) / a) : b - a;
      if (d === null || !Number.isFinite(d)) return "";
      const shown = col.arrows ? Math.abs(d) : d;
      const text = `${col.arrows ? (d > 0 ? "▲ " : d < 0 ? "▼ " : "") : ""}${formatNumber(col.percent ? shown * 100 : shown, { digits: col.decimals, forceSign: col.forceSign && !col.arrows })}${col.percent ? "%" : ""}`;
      const color = !col.color
        ? null
        : d > 0
          ? col.colorPositive
          : d < 0
            ? col.colorNegative
            : (col.colorNeutral ?? null);
      return color ? `<span style="color:${escapeAttr(color)}">${escapeHtml(text)}</span>` : escapeHtml(text);
    }
    case "tally": {
      const ns = col.keys.map((k) => toNumber(cellValue(row, k)));
      if (ns.some((n) => n === null)) {
        const v = cellValue(row, col.key);
        return isBlank(v) ? "" : escapeHtml(v);
      }
      const xs = ns as number[];
      if (col.share && !(Number.isInteger(col.shareOf) && col.shareOf >= 0 && col.shareOf < xs.length))
        throw new TableSpecError(`tally shareOf must index (from 0) one of ${col.keys.join(", ")}`);
      const text = xs.map((n) => naturalDigits(n)).join(col.separator);
      const total = xs.reduce((s, n) => s + n, 0);
      if (!col.share || total === 0) return escapeHtml(text);
      return escapeHtml(
        `${text}${col.sharePrefix}${formatNumber(((xs[col.shareOf] ?? 0) / total) * 100, { digits: col.shareDecimals })}%${col.shareSuffix}`,
      );
    }
    default:
      throw new TableSpecError(`renderCell: kind ${col.kind} not yet implemented (Tasks 6–8)`); // Task 8 replaces this with the exhaustive `never` check
  }
}
/** Bare `prop:value` declarations a column kind puts on its own `<td>` (Task 7 team colors; Task 8 colorRanks/highlight/highlightNa); "" otherwise. */
export function kindCellStyle<Row>(
  _col: ColumnSpec<Row>,
  _row: Row,
  _i: number,
  _ctx: RenderContext<Row>,
): string {
  return "";
}
