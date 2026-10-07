// src/snake.ts — gt_snake_align: blocks and rows per block as Python _snake_shape (_layout.py:1630-1640)
import { TableSpecError } from "./errors.js";

export function snakeAlign<Row>(
  rows: readonly Row[],
  o: { nCols?: number; rowsPerCol?: number; fill?: Row | null } = {},
): (Row | null)[][] {
  let blocks: number;
  let per: number;
  if (o.rowsPerCol !== undefined) {
    per = Math.trunc(o.rowsPerCol);
    if (!(per >= 1)) throw new TableSpecError("rowsPerCol must be at least 1");
    blocks = Math.ceil(rows.length / per);
  } else {
    blocks = Math.trunc(o.nCols ?? 2);
    if (!(blocks >= 1)) throw new TableSpecError("nCols must be at least 1");
    per = Math.ceil(rows.length / blocks);
  }
  const fill = o.fill ?? null;
  return Array.from({ length: blocks }, (_, j) =>
    Array.from({ length: per }, (_, k) => rows[j * per + k] ?? fill),
  );
}
