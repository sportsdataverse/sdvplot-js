// src/html/layout.ts — the two decorations that reshape the table rather than style it
import { snakeAlign } from "../snake.js";
import type { ColumnSpec, Decoration, TableSpec } from "../spec.js";
import { escapeHtml } from "./escape.js";

type Tiers<Row> = Extract<Decoration<Row>, { type: "tiers" }>;
type Snake<Row> = Extract<Decoration<Row>, { type: "snake" }>;

/** gt_tiers' reshaping (_layout.py:870-890): theme `tier` (style), image columns at imgHeight, every label blanked. */
export function expandTiers<Row>(spec: TableSpec<Row>): TableSpec<Row> {
  const d = spec.decorations.find((x): x is Tiers<Row> => x.type === "tiers");
  if (!d) return spec;
  const columns = spec.columns.map((c): ColumnSpec<Row> => {
    if (!d.imageColumns.includes(c.key)) return { ...c, label: "" };
    return {
      key: c.key,
      label: "",
      kind: "image",
      height: d.imgHeight,
      ...(c.align ? { align: c.align } : {}),
      ...(c.width ? { width: c.width } : {}),
    };
  });
  return {
    ...spec,
    theme: { name: "tier", density: spec.theme.density, options: { style: d.style } },
    columns,
  };
}

/** gt_snake: N side-by-side blocks inside ONE <table>; each output row carries the FIRST block's data-row and row hooks.
 * Returns null when Python leaves the table unchanged (fewer than two blocks, or no rows). */
export function snakeLayout<Row>(
  d: Snake<Row>,
  rows: readonly Row[],
  headCells: string,
  ncol: number,
  rowHtml: (row: Row, i: number) => string,
  trOf: (i: number, cells: string) => string,
  gapTh: string,
  gapTd: string,
): { head: string; body: string[] } | null {
  const blocks = snakeAlign(
    rows.map((row, i) => ({ row, i })),
    { nCols: d.nCols, ...(d.rowsPerCol !== undefined ? { rowsPerCol: d.rowsPerCol } : {}) },
  );
  if (blocks.length < 2 || rows.length === 0) return null;
  const per = blocks[0]?.length ?? 0;
  const blank = `<td class="sdvt-cell sdvt-blank">${escapeHtml(d.fill)}</td>`.repeat(ncol);
  const body = Array.from({ length: per }, (_, k) =>
    trOf(
      blocks[0]?.[k]?.i ?? k,
      blocks
        .map((b) => {
          const e = b[k];
          return e ? rowHtml(e.row, e.i) : blank;
        })
        .join(gapTd),
    ),
  );
  return { head: blocks.map(() => headCells).join(gapTh), body };
}
