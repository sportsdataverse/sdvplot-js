// src/html/escape.ts
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
/** `{ "background-color": "#fff", "font-size": null }` → `background-color:#fff` (nulls dropped; values escaped). Bare declarations, no `style=`. */
export function styleAttr(decl: Readonly<Record<string, string | number | null | undefined>>): string {
  return Object.entries(decl)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${escapeAttr(v)}`)
    .join(";");
}
/** The ONE place a `style="…"` attribute is built: declaration lists joined with ";" in order (later wins in CSS); "" when all are empty. */
export function styleOf(decls: readonly string[]): string {
  const s = decls.filter((x) => x !== "").join(";");
  return s ? ` style="${s}"` : "";
}
