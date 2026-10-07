// src/html/cells.ts — Task 5 version: the context types + dispatcher + text; Tasks 6–8 add the other kinds in this file
import { TableSpecError } from "../errors.js";
import type { ColumnSpec, TableSpec } from "../spec.js";
import type { Theme } from "../themes/tokens.js";
import { escapeHtml } from "./escape.js";
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
export function renderCell<Row>(
  col: ColumnSpec<Row>,
  row: Row,
  _i: number,
  _ctx: RenderContext<Row>,
): string {
  switch (col.kind) {
    case "text":
      return escapeHtml(cellValue(row, col.key));
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
