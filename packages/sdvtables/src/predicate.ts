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
export function selectRows<Row>(sel: RowSelector<Row>, rows: readonly Row[]): number[] {
  if (Array.isArray(sel)) {
    for (const i of sel)
      if (!Number.isInteger(i) || i < 0 || i >= rows.length)
        throw new TableSpecError(`row ${i} is outside 0..${rows.length - 1}`);
    return [...sel];
  }
  const out: number[] = [];
  rows.forEach((r, i) => {
    if (matches(sel as Predicate<Row>, r)) out.push(i);
  });
  return out;
}
