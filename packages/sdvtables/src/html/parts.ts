// src/html/parts.ts — Phase 4's renderHTML body (moved from index.ts), split into strings so the static path,
// renderHTML(table), hydrate and <SdvTable/> share ONE renderer (Phase 5 Task 2).
import { warn } from "@sportsdataverse/sdvplot";
import type { Sort } from "../engine.js";
import { TableSpecError } from "../errors.js";
import type { ColumnSpec, Decoration, TableSpec, ThemeRef } from "../spec.js";
import { fnv1a32, tableId } from "../table-id.js";
import { BASE_CSS, tokensCSS } from "../themes/base-css.js";
import { resolveTheme } from "../themes/index.js";
import type { GoogleFont, Theme } from "../themes/tokens.js";
import { type RenderContext, columnScales, kindCellStyle, renderCell, teamIdsOf } from "./cells.js";
import { applyDecorations } from "./decorations.js";
import { cssValue, escapeAttr, escapeHtml, styleOf } from "./escape.js";
import { fontsLink } from "./fonts.js";
import { expandTiers, snakeLayout } from "./layout.js";

export interface RenderOptions {
  readonly css?: "inline" | "none";
  readonly fonts?: boolean;
  /** Phase 5: emit aria-sort + a sort button on every `sortable !== false` column */
  readonly interactive?: boolean;
  /** Phase 5: the engine's current sort, for aria-sort */
  readonly sort?: Sort | null;
  /** Phase 5: engine-hidden column keys (merged with decoration-hidden columns) */
  readonly hidden?: readonly string[];
  /** J31 (A5): page-relative indices of selected rows → `sdvt-selected` on their <tr> */
  readonly selected?: ReadonlySet<number>;
  /** J31 (A4): rows the scale/legend domains are computed from; default the rendered rows */
  readonly domainRows?: readonly unknown[];
}
export interface RenderedParts {
  readonly id: string;
  /** the Google Fonts <link>, or "" */
  readonly link: string;
  /** class, id, data-sdvt-theme, data-sdvt-density — UNESCAPED values, in this order */
  readonly wrapperAttrs: Readonly<Record<string, string>>;
  /** the shared theme sheet (`styleSheet`) without the tag, or "" when css === "none" */
  readonly sheet: string;
  /** the decorations' own rules without the tag, or "" — part of the table block, so hydrate re-renders them */
  readonly rules: string;
  readonly before: string;
  readonly caption: string;
  readonly headRows: string;
  /** the <th> cells of the main header row */
  readonly head: string;
  /** every body <tr> (group header rows included) */
  readonly rows: string;
  readonly foot: string;
  readonly after: string;
}

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
/** The `<style>` body without the tag: token block + base sheet + the theme's own rules, scoped to `.sdvt-t-<key>`. A host page emits it once per key. */
export function styleSheet<Row>(spec: TableSpec<Row>, theme: Theme = resolveTheme(spec.theme)): string {
  const sel = `.${themeKey(spec.theme)}`;
  return `${tokensCSS(sel, theme.tokens)}\n${BASE_CSS(sel)}\n${theme.rules(sel)}`;
}

export function sortAria(sort: Sort | null | undefined, key: string): "ascending" | "descending" | "none" {
  if (!sort || sort.col !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}
export function attrsText(attrs: Readonly<Record<string, string>>): string {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join("");
}
const styleTag = (css: string): string => (css ? `<style>${css}</style>` : "");
/** The table block: the decorations' own <style>, then before + <table> + after. hydrate re-renders exactly this. */
export function tableHTML(p: RenderedParts): string {
  return `${styleTag(p.rules)}${p.before}<table>${p.caption}<thead>${p.headRows}<tr>${p.head}</tr></thead><tbody>${p.rows}</tbody>${p.foot}</table>${p.after}`;
}
/** The fonts link, then the wrapper holding the theme sheet and `inner` (default: the table block). */
export function assemble(p: RenderedParts, inner: string = tableHTML(p)): string {
  return `${p.link ? `${p.link}\n` : ""}<div${attrsText(p.wrapperAttrs)}>${styleTag(p.sheet)}${inner}</div>`;
}

export function renderParts<Row>(
  input: TableSpec<Row>,
  rows: readonly Row[],
  opts: RenderOptions = {},
): RenderedParts {
  checkKeys(input, rows);
  const id = tableId(input); // the spec as built, before tier expansion
  const spec = expandTiers(input);
  const theme = resolveTheme(spec.theme);
  if (!/^[A-Za-z][\w-]*$/.test(id))
    throw new TableSpecError(
      `table id ${JSON.stringify(id)} must match /^[A-Za-z][\\w-]*$/ (it becomes a CSS selector)`,
    );
  const sel = `#${id}`;
  const groupBy = spec.decorations.find(
    (d): d is Extract<Decoration<Row>, { type: "groupBy" }> => d.type === "groupBy",
  );
  const scales = columnScales(spec, rows, warn, (opts.domainRows ?? rows) as readonly Row[]); // J31 (A4)
  const ctx: RenderContext<Row> = {
    spec,
    rows,
    theme,
    id,
    sel,
    columns: spec.columns,
    groupKey: groupBy?.key,
    warn,
    teamIds: teamIdsOf(spec, rows),
    scales,
    recorded: [...scales.values()].at(-1),
    scaled: new Map(),
  };
  const deco = applyDecorations(spec, rows, ctx);
  const engineHidden = opts.hidden ?? [];
  const visible = spec.columns.filter((c) => !deco.hiddenColumns.has(c.key) && !engineHidden.includes(c.key));
  const ncol = visible.length;
  let head = visible
    .map((c) => {
      const label = `${deco.label(c, (deco.labelText.get(c.key) ?? labelOf(c)) + deco.labelSuffix(c.key))}${c.subheader ? `<span class="sdvt-subheader">${escapeHtml(c.subheader)}</span>` : ""}`;
      const sortable = opts.interactive === true && c.sortable !== false;
      const aria = sortable ? ` aria-sort="${sortAria(opts.sort, c.key)}"` : "";
      const inner = sortable
        ? `<button type="button" class="sdvt-sort" data-sdv-sort="${escapeAttr(c.key)}">${label}</button>`
        : label;
      return `<th scope="col" class="sdvt-label sdvt-${escapeAttr(alignOf(c))}" data-col="${escapeAttr(c.key)}" data-kind="${escapeAttr(c.kind)}"${aria}${styleOf([c.width ? `width:${escapeAttr(cssValue(c.width, `column ${c.key} width`))}` : "", deco.labelStyle(c.key)])}>${inner}</th>`;
    })
    .join("");
  const cellsOf = (row: Row, i: number): string =>
    visible
      .map(
        (c) =>
          `<td class="sdvt-cell sdvt-kind-${escapeAttr(c.kind)} sdvt-${escapeAttr(alignOf(c))}" data-col="${escapeAttr(c.key)}"${styleOf([kindCellStyle(c, row, i, ctx), deco.cellStyle(i, c.key)])}>${renderCell(c, row, i, ctx)}${deco.cellSuffix(i, c.key)}</td>`,
      )
      .join("");
  // opt_row_striping: great_tables marks every second DISPLAYED data row (j % 2 == 1 over the body in display order, group headers not counted)
  const striped = theme.tokens.stripe !== "transparent";
  let shown = 0;
  const trOf = (i: number, cells: string): string =>
    `<tr class="sdvt-row${striped && shown++ % 2 === 1 ? " sdvt-stripe" : ""}${deco.rowClass(i)}${opts.selected?.has(i) === true ? " sdvt-selected" : ""}" data-row="${i}"${styleOf([deco.rowStyle(i)])}>${cells}</tr>`;
  let body: string[] = [];
  const snake = spec.decorations.find(
    (d): d is Extract<Decoration<Row>, { type: "snake" }> => d.type === "snake",
  );
  if (snake && ctx.groupKey !== undefined) throw new TableSpecError("snake cannot be combined with groupBy");
  const gap = snake && snake.gap > 0 ? `style="width:${snake.gap}px;border:none"` : "";
  const snaked = snake
    ? snakeLayout(
        snake,
        rows,
        head,
        ncol,
        cellsOf,
        trOf,
        gap ? `<th class="sdvt-gap" ${gap}></th>` : "",
        gap ? `<td class="sdvt-gap" ${gap}></td>` : "",
      )
    : null;
  if (snake && snaked) {
    head = snaked.head;
    body = snaked.body;
    if (snake.cleanGaps)
      deco.css.push(
        `${sel} .sdvt-gap,${sel} td.sdvt-blank{border:none!important;background:transparent!important;box-shadow:none!important}`,
      );
  } else {
    // Stable partition by first-appearance group (gt groupname_col): one header per group, rows keep their original index.
    const groups = new Map<unknown, number[]>();
    if (ctx.groupKey === undefined)
      groups.set(
        undefined,
        rows.map((_, i) => i),
      );
    else
      rows.forEach((row, i) => {
        const g = (row as Record<string, unknown>)[ctx.groupKey as string];
        const list = groups.get(g);
        if (list) list.push(i);
        else groups.set(g, [i]);
      });
    let groupIndex = -1;
    for (const [g, idxs] of groups) {
      groupIndex++;
      if (ctx.groupKey !== undefined)
        body.push(
          `<tr class="sdvt-group-row${deco.groupRowClass(groupIndex)}"><th scope="rowgroup" colspan="${ncol}" class="sdvt-group">${escapeHtml(g)}</th></tr>`,
        );
      for (const i of idxs) body.push(trOf(i, cellsOf(rows[i] as Row, i)));
    }
  }
  const fonts: GoogleFont[] = [...theme.fonts, ...deco.fonts];
  const name = spec.theme.name;
  return {
    id,
    link: opts.fonts === false ? "" : fontsLink(fonts), // css:"none" drops only the shared theme sheet (A98, A100)
    wrapperAttrs: {
      class: `sdvt sdvt-theme-${name} ${themeKey(spec.theme)}`,
      id,
      "data-sdvt-theme": name,
      "data-sdvt-density": spec.theme.density,
    },
    sheet: opts.css === "none" ? "" : styleSheet(spec, theme),
    rules: deco.css.join("\n"),
    before: deco.before,
    caption: deco.caption ? `<caption>${deco.caption}</caption>` : "",
    headRows: deco.headRows,
    head,
    rows: body.join(""),
    foot:
      deco.foot.length > 0
        ? `<tfoot>${deco.foot.map((f) => `<tr><td colspan="${ncol}">${f}</td></tr>`).join("")}</tfoot>`
        : "",
    after: deco.after,
  };
}
// ponytail: renders the empty table to get the font link; cheap and always consistent with renderHTML
export const fontsLinkFor = <Row>(spec: TableSpec<Row>): string => renderParts(spec, []).link;
