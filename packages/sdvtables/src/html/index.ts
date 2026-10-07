// src/html/index.ts — the renderer. One pass over rows; cells and decorations are pure functions of (spec, rows, ctx).
import { loadGsis, loadLeague, warn } from "@sportsdataverse/sdvplot";
import type { League } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import type { ColumnSpec, Decoration, TableSpec, ThemeRef } from "../spec.js";
import { fnv1a32, tableId } from "../table-id.js";
import { BASE_CSS, tokensCSS } from "../themes/base-css.js";
import { resolveTheme } from "../themes/index.js";
import type { GoogleFont, Theme } from "../themes/tokens.js";
import { type RenderContext, kindCellStyle, renderCell } from "./cells.js";
import { applyDecorations } from "./decorations.js";
import { escapeAttr, escapeHtml, styleOf } from "./escape.js";
import { fontsLink } from "./fonts.js";

export interface RenderOptions {
  readonly css?: "inline" | "none";
  readonly fonts?: boolean;
}
export type { ColumnScale, RenderContext } from "./cells.js";

function checkKeys<Row>(spec: TableSpec<Row>, rows: readonly Row[]): void {
  const first = rows[0];
  if (first === undefined) return;
  const keys = new Set(Object.keys(first as object));
  for (const col of spec.columns) {
    const need: string[] = [
      col.key,
      ...("to" in col ? [col.to] : []),
      ...("keys" in col ? col.keys : []),
      ...("stack" in col ? [col.stack, col.team] : []),
    ];
    for (const k of need)
      if (!keys.has(k))
        throw new TableSpecError(
          `column "${k}" (kind ${col.kind}) is not a key of the first row; keys are ${[...keys].join(", ")}`,
        );
  }
}
/** Leagues whose shards the spec needs (team-aware columns + the sdvTeam theme). Headshot columns need no shard: ESPN ids are pure URLs. */
export function leaguesOf<Row>(spec: TableSpec<Row>): League[] {
  const out = new Set<League>();
  for (const c of spec.columns) if ("league" in c && c.kind !== "headshot") out.add(c.league);
  if (spec.theme.name === "sdvTeam" && spec.theme.options?.league)
    out.add(spec.theme.options.league as League);
  return [...out];
}
/** The documented preparation step: every league shard the spec names, plus the gsis map when a headshot column uses gsis ids (J27). Task 7 adds team names. */
export async function prepare<Row>(spec: TableSpec<Row>): Promise<void> {
  const gsis = spec.columns.some((c) => c.kind === "headshot" && c.idSystem === "gsis");
  await Promise.all([...leaguesOf(spec).map((l) => loadLeague(l)), ...(gsis ? [loadGsis()] : [])]);
}

function alignOf<Row>(col: ColumnSpec<Row>): "left" | "center" | "right" {
  if (col.align) return col.align;
  switch (col.kind) {
    case "num":
    case "int":
    case "pct":
    case "rank":
    case "delta":
    case "tally":
    case "colorPills":
    case "colorRanks":
      return "right";
    case "logo":
    case "wordmark":
    case "headshot":
    case "indicatorBox":
    case "image":
      return "center";
    default:
      return "left";
  }
}
export function labelOf<Row>(col: ColumnSpec<Row>): string {
  return col.label ?? col.key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Class shared by every table with the same theme name + density + options (two sdvTeam tables for different teams get different keys). */
export function themeKey(ref: ThemeRef): string {
  return `sdvt-t-${fnv1a32(JSON.stringify([ref.name, ref.density, Object.entries(ref.options ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))]))}`;
}
/** The `<style>` body without the tag: token block + base sheet, scoped to `.sdvt-t-<key>`. A host page emits it once per key. */
export function styleSheet<Row>(spec: TableSpec<Row>, theme: Theme = resolveTheme(spec.theme)): string {
  const sel = `.${themeKey(spec.theme)}`;
  return `${tokensCSS(sel, theme.tokens)}\n${BASE_CSS(sel)}`;
}

export function renderHTML<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  opts: RenderOptions = {},
): string {
  checkKeys(spec, rows);
  const theme = resolveTheme(spec.theme);
  const id = tableId(spec);
  const sel = `#${id}`;
  const groupBy = spec.decorations.find(
    (d): d is Extract<Decoration<Row>, { type: "groupBy" }> => d.type === "groupBy",
  );
  const ctx: RenderContext<Row> = {
    spec,
    rows,
    theme,
    id,
    sel,
    columns: spec.columns,
    groupKey: groupBy?.key,
    warn,
    teamIds: new Map(),
    scales: new Map(),
    recorded: undefined,
    scaled: new Map(),
  };
  const deco = applyDecorations(spec, rows, ctx);
  const visible = spec.columns.filter((c) => !deco.hiddenColumns.has(c.key));
  const ncol = visible.length;
  const head = visible
    .map(
      (c) =>
        `<th scope="col" class="sdvt-label sdvt-${alignOf(c)}" data-col="${escapeAttr(c.key)}" data-kind="${c.kind}"${styleOf([c.width ? `width:${escapeAttr(c.width)}` : "", deco.labelStyle(c.key)])}>${deco.label(c, (deco.labelText.get(c.key) ?? labelOf(c)) + deco.labelSuffix(c.key))}${c.subheader ? `<span class="sdvt-subheader">${escapeHtml(c.subheader)}</span>` : ""}</th>`,
    )
    .join("");
  const body: string[] = [];
  let lastGroup: unknown = Symbol("none");
  let groupIndex = -1;
  rows.forEach((row, i) => {
    if (ctx.groupKey !== undefined) {
      const g = (row as Record<string, unknown>)[ctx.groupKey];
      if (g !== lastGroup) {
        groupIndex++;
        body.push(
          `<tr class="sdvt-group-row${deco.groupRowClass(groupIndex)}"><th scope="rowgroup" colspan="${ncol}" class="sdvt-group">${escapeHtml(g)}</th></tr>`,
        );
        lastGroup = g;
      }
    }
    const cells = visible
      .map(
        (c) =>
          `<td class="sdvt-cell sdvt-kind-${c.kind} sdvt-${alignOf(c)}" data-col="${escapeAttr(c.key)}"${styleOf([kindCellStyle(c, row, i, ctx), deco.cellStyle(i, c.key)])}>${renderCell(c, row, i, ctx)}${deco.cellSuffix(i, c.key)}</td>`,
      )
      .join("");
    body.push(
      `<tr class="sdvt-row${deco.rowClass(i)}" data-row="${i}"${styleOf([deco.rowStyle(i)])}>${cells}</tr>`,
    );
  });
  const caption = deco.caption ? `<caption>${deco.caption}</caption>` : "";
  const foot =
    deco.foot.length > 0
      ? `<tfoot>${deco.foot.map((f) => `<tr><td colspan="${ncol}">${f}</td></tr>`).join("")}</tfoot>`
      : "";
  const css =
    opts.css === "none"
      ? ""
      : `<style>${styleSheet(spec, theme)}\n${theme.rules(sel)}\n${deco.css.join("\n")}</style>`;
  const fonts: GoogleFont[] = [...theme.fonts, ...deco.fonts];
  const link = opts.fonts === false || opts.css === "none" ? "" : fontsLink(fonts);
  const name = escapeAttr(spec.theme.name);
  return `${link ? `${link}\n` : ""}<div class="sdvt sdvt-theme-${name} ${themeKey(spec.theme)}" id="${escapeAttr(id)}" data-sdvt-theme="${name}" data-sdvt-density="${spec.theme.density}">${css}${deco.before}<table>${caption}<thead>${deco.headRows}<tr>${head}</tr></thead><tbody>${body.join("")}</tbody>${foot}</table>${deco.after}</div>`;
}
export async function renderHTMLAsync<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  opts: RenderOptions = {},
): Promise<string> {
  await prepare(spec);
  return renderHTML(spec, rows, opts);
}
export function toElement<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  opts: RenderOptions = {},
): HTMLElement {
  if (typeof document === "undefined")
    throw new TableSpecError("toElement needs a DOM (browser, happy-dom or jsdom); use renderHTML in Node");
  const t = document.createElement("template");
  t.innerHTML = renderHTML(spec, rows, opts).trim();
  const el = t.content.querySelector("div.sdvt");
  if (!(el instanceof HTMLElement)) throw new TableSpecError("renderHTML produced no wrapper");
  return el;
}
export { labelOf as columnLabel };
