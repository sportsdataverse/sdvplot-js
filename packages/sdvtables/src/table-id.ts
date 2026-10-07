// src/table-id.ts — deterministic id from the spec (functions dropped by JSON.stringify, which is what we want).
// JSON.stringify is key-order sensitive: the builder always emits one key order, so a built spec and its JSON round-trip share an id.
import type { TableSpec } from "./spec.js";

export function fnv1a32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
export function tableId<Row>(spec: TableSpec<Row>): string {
  return spec.id ?? `sdvt-${fnv1a32(JSON.stringify(spec))}`;
}
