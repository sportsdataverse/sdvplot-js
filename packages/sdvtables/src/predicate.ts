// src/predicate.ts
import { TableSpecError } from "./errors.js";
import type { Predicate, RowSelector } from "./spec.js";
const isNull = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
export function matches<Row>(p: Predicate<Row>, row: Row): boolean {
  const v = (row as Record<string, unknown>)[p.key];
  switch (p.op) {
    case "isNull":
      return isNull(v);
    case "notNull":
      return !isNull(v);
    case "==":
      return v === p.value;
    case "!=":
      return v !== p.value;
    case ">":
      return typeof v === "number" && v > (p.value as number);
    case ">=":
      return typeof v === "number" && v >= (p.value as number);
    case "<":
      return typeof v === "number" && v < (p.value as number);
    case "<=":
      return typeof v === "number" && v <= (p.value as number);
    case "in":
      return Array.isArray(p.value) && p.value.includes(v);
    case "notIn":
      return Array.isArray(p.value) && !p.value.includes(v);
    case "matches":
      return typeof v === "string" && new RegExp(String(p.value)).test(v);
    default: {
      const bad: never = p.op;
      throw new TableSpecError(`unknown predicate op ${String(bad)}`);
    }
  }
}
/**
 * The indices into `rows` that `sel` picks. A predicate tests each row; an index array names positions in `source`
 * (default `rows`), matched to `rows` by identity. An interactive render passes the table's source rows, so `[5]`
 * stays the sixth data row whatever page, filter or sort shows it (A49). Throws `TableSpecError` for an index outside `source`.
 */
export function selectRows<Row>(
  sel: RowSelector<Row>,
  rows: readonly Row[],
  source: readonly Row[] = rows,
): number[] {
  if (Array.isArray(sel)) {
    for (const i of sel)
      if (!Number.isInteger(i) || i < 0 || i >= source.length)
        throw new TableSpecError(`row ${i} is outside 0..${source.length - 1}`);
    if (source === rows) return [...sel];
    const want = new Set(sel.map((i) => source[i])); // ponytail: one Set per selector, O(rows); no index map needed
    return rows.flatMap((r, i) => (want.has(r) ? [i] : []));
  }
  const out: number[] = [];
  rows.forEach((r, i) => {
    if (matches(sel as Predicate<Row>, r)) out.push(i);
  });
  return out;
}
