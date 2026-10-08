import { InputError } from "@sportsdataverse/sdvplot";
import { escapeHtml } from "../html/escape.js";
import { renderHTML } from "../html/index.js";
import type { TableSpec } from "../spec.js";

export type TableItem<Row> = { spec: TableSpec<Row>; rows: readonly Row[] } | string;
export interface ComposeOptions {
  title?: string;
  subtitle?: string;
  caption?: string;
  sourceNote?: string;
  captionRule?: boolean;
}
export interface GridOptions extends ComposeOptions {
  ncol?: number;
  gap?: number;
  align?: "top" | "center" | "bottom";
  labels?: readonly string[];
}
export interface StackOptions extends ComposeOptions {
  gap?: number;
  align?: "left" | "center" | "right";
}

/**
 * Python `_STYLE_DEFAULTS` (_export.py:469-475) as one sheet: title 28px/700/#111111 centred, subtitle 16px/400/#666666
 * centred, caption 12px/400/#8A8A8A centred, source note 12px/400/#8A8A8A right, grid label 12px/600/#555555 left, all in
 * `system-ui, -apple-system, sans-serif` (:467). A title with no subtitle keeps the subtitle's 12px gap (:564-565);
 * `captionRule` is a 1px rule UNDER the caption in its colour, padded 6px (:566-567, :574).
 */
const COMPOSE_CSS =
  ".sdvt-compose{display:inline-block;font-family:system-ui,-apple-system,sans-serif}" +
  ".sdvt-compose-title{font-size:28px;font-weight:700;color:#111111;text-align:center;margin:0 0 4px}" +
  ".sdvt-compose-title:last-child{margin-bottom:12px}" +
  ".sdvt-compose-subtitle{font-size:16px;font-weight:400;color:#666666;text-align:center;margin:0 0 12px}" +
  ".sdvt-compose-caption{font-size:12px;font-weight:400;color:#8A8A8A;text-align:center;margin:10px 0 0}" +
  ".sdvt-compose-source{font-size:12px;font-weight:400;color:#8A8A8A;text-align:right;margin:6px 0 0}" +
  ".sdvt-compose-rule{border-bottom:1px solid #8A8A8A;padding-bottom:6px}" +
  ".sdvt-compose-label{font-size:12px;font-weight:600;color:#555555;text-align:left;margin:0 0 6px}";

export function slug(value: unknown): string {
  return String(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function itemHTML<Row>(item: TableItem<Row>): string {
  return typeof item === "string" ? item : renderHTML(item.spec, item.rows);
}
function checkItems<Row>(items: readonly TableItem<Row>[]): void {
  if (items.length === 0) throw new InputError("at least one table is required");
}
function checkPixels(name: string, value: number): void {
  if (!(Number.isFinite(value) && value >= 0))
    throw new InputError(`${name} must be a non-negative number of pixels, got ${String(value)}`);
}
/** Python's `align not in places` check: the CSS value for a known name, else InputError. */
function placeOf(align: string, places: Readonly<Record<string, string>>): string {
  const place = places[align];
  if (place === undefined)
    throw new InputError(
      `align must be one of ${Object.keys(places).join(", ")}, got ${JSON.stringify(align)}`,
    );
  return place;
}

/** A table's wrapper as `assemble` writes it (class, then id); ids match /^[A-Za-z][\w-]*$/, so no regex escaping. */
const WRAPPER = /<div class="sdvt [^"]*" id="([A-Za-z][\w-]*)"/g;

/**
 * One spec composed twice renders one wrapper id twice: every repeat gets the first free `-2`, `-3`… suffix, on its
 * wrapper (and the `id`/`for` of its controls) and on the `#id` selectors of its own `<style>`s, so each table
 * keeps its decorations. A table is the markup from its wrapper to the next one.
 */
function uniqueIds(body: string): string {
  const starts = [...body.matchAll(WRAPPER)];
  const taken = new Set(starts.map((m) => m[1] as string));
  if (taken.size === starts.length) return body;
  const seen = new Set<string>();
  let out = body.slice(0, starts[0]?.index);
  starts.forEach((m, i) => {
    const id = m[1] as string;
    let table = body.slice(m.index, starts[i + 1]?.index);
    if (seen.has(id)) {
      let n = 2;
      while (taken.has(`${id}-${n}`)) n++;
      const to = `${id}-${n}`;
      taken.add(to);
      table = table
        .replace(new RegExp(`(\\s(?:id|for)=")${id}(?=["-])`, "g"), `$1${to}`)
        .replace(/<style>[\s\S]*?<\/style>/g, (css) =>
          css.replace(new RegExp(`#${id}(?![\\w-])`, "g"), `#${to}`),
        );
    }
    seen.add(id);
    out += table;
  });
  return out;
}

/** Title/subtitle above, caption/source note below — the shared frame of gt_grid and gt_stack_tables. */
export function composePage(
  body: string,
  { title, subtitle, caption, sourceNote, captionRule = false }: ComposeOptions = {},
): string {
  const head =
    title || subtitle
      ? `<header class="sdvt-compose-head">${title ? `<div class="sdvt-compose-title">${escapeHtml(title)}</div>` : ""}${subtitle ? `<p class="sdvt-compose-subtitle">${escapeHtml(subtitle)}</p>` : ""}</header>`
      : "";
  const foot =
    caption || sourceNote
      ? `<footer class="sdvt-compose-foot">${caption ? `<p class="sdvt-compose-caption${captionRule ? " sdvt-compose-rule" : ""}">${escapeHtml(caption)}</p>` : ""}${sourceNote ? `<p class="sdvt-compose-source">${escapeHtml(sourceNote)}</p>` : ""}</footer>`
      : "";
  return `<div class="sdvt-compose"><style>${COMPOSE_CSS}</style>${head}${uniqueIds(body)}${foot}</div>`;
}

/** Port of gt_grid: small multiples, `ncol` across, rows follow from the count. */
export function gridTables<Row>(
  items: readonly TableItem<Row>[],
  { ncol = 2, gap = 24, align = "top", labels, ...compose }: GridOptions = {},
): string {
  checkItems(items);
  if (!Number.isInteger(ncol) || ncol < 1)
    throw new InputError(`ncol must be an integer of at least 1, got ${String(ncol)}`);
  const place = placeOf(align, { top: "start", center: "center", bottom: "end" });
  checkPixels("gap", gap);
  if (labels !== undefined && labels.length === 0)
    throw new InputError("labels must be non-empty; omit it for no labels");
  const cells = items.map((item, i) => {
    const label =
      labels === undefined
        ? ""
        : `<div class="sdvt-compose-label">${escapeHtml(labels[i % labels.length] ?? "")}</div>`;
    return `<div class="sdvt-compose-cell">${label}${itemHTML(item)}</div>`;
  });
  const grid = `<div class="sdvt-grid" style="display:grid;grid-template-columns:repeat(${ncol},max-content);gap:${gap}px;align-items:${place};justify-content:center">${cells.join("")}</div>`;
  return composePage(grid, compose);
}

/** Port of gt_stack_tables: a vertical stack. */
export function stackTables<Row>(
  items: readonly TableItem<Row>[],
  { gap = 16, align = "center", ...compose }: StackOptions = {},
): string {
  checkItems(items);
  const place = placeOf(align, { left: "flex-start", center: "center", right: "flex-end" });
  checkPixels("gap", gap);
  const stack = `<div class="sdvt-stack" style="display:flex;flex-direction:column;gap:${gap}px;align-items:${place}">${items.map(itemHTML).join("")}</div>`;
  return composePage(stack, compose);
}
