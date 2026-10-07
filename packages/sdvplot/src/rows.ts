import { InputError } from "./errors.js";

/** Column form → `Row[]` (flat objects, one per index). Columns must be equal length; `{}` → `[]`. */
export function rowsFrom(columns: Record<string, readonly unknown[]>): Record<string, unknown>[] {
  const keys = Object.keys(columns);
  const n = keys.length ? (columns[keys[0] as string] as readonly unknown[]).length : 0;
  for (const k of keys) {
    const len = (columns[k] as readonly unknown[]).length;
    if (len !== n) throw new InputError(`rowsFrom: column "${k}" has length ${len}, expected ${n}`);
  }
  return Array.from({ length: n }, (_, i) => {
    const row: Record<string, unknown> = {};
    for (const k of keys) row[k] = (columns[k] as readonly unknown[])[i];
    return row;
  });
}
