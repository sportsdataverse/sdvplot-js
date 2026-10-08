// src/html/escape.ts
import { TableSpecError } from "../errors.js";
const MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeHtml = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => MAP[c] as string);
export const escapeAttr: (s: unknown) => string = escapeHtml;
/** What can end a CSS declaration, rule, string, attribute or element. */
const CSS_UNSAFE = /[;{}<>"\\\n\r]/;
/** True when `v` can sit in a CSS declaration value as is (the non-throwing check, for data). */
export const isCssValue = (v: unknown): boolean => !CSS_UNSAFE.test(String(v));
/** A spec value bound for a CSS declaration (deco `<style>` rule or inline style): returned as is, or TableSpecError naming the field. */
export function cssValue(v: unknown, field: string): string {
  const s = String(v);
  if (CSS_UNSAFE.test(s))
    throw new TableSpecError(
      `${field} ${JSON.stringify(s)} is not a CSS value: it may not contain ; { } < > " \\ or a line break`,
    );
  return s;
}
/** A spec number bound for CSS: a finite number (or numeric string), else TableSpecError naming the field; null and "" are rejected. */
export function checkPx(v: unknown, field: string): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n))
    throw new TableSpecError(`${field} must be a finite number, got ${JSON.stringify(v)}`);
  return n;
}
/** `{ "background-color": "#fff", "font-size": null }` → `background-color:#fff` (nulls dropped; values CSS-checked and escaped). Bare declarations, no `style=`. */
export function styleAttr(decl: Readonly<Record<string, string | number | null | undefined>>): string {
  return Object.entries(decl)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${escapeAttr(cssValue(v, `CSS ${k}`))}`)
    .join(";");
}
/** The ONE place a `style="…"` attribute is built: declaration lists joined with ";" in order (later wins in CSS); "" when all are empty. */
export function styleOf(decls: readonly string[]): string {
  const s = decls.filter((x) => x !== "").join(";");
  return s ? ` style="${s}"` : "";
}
