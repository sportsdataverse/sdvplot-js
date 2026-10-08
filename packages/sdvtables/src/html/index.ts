// src/html/index.ts — the renderer. One pass over rows; cells and decorations are pure functions of (spec, rows, ctx).
import { loadGsis, loadLeague, warn } from "@sportsdataverse/sdvplot";
import type { League } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import type { ColumnSpec, Decoration, Density, TableSpec, ThemeRef } from "../spec.js";
import { fnv1a32, tableId } from "../table-id.js";
import { loadTeamNames } from "../team-name.js";
import { BASE_CSS, tokensCSS } from "../themes/base-css.js";
import { THEME_NAMES, resolveTheme } from "../themes/index.js";
import type { GoogleFont, Theme } from "../themes/tokens.js";
import { type RenderContext, columnScales, kindCellStyle, renderCell, teamIdsOf } from "./cells.js";
import { applyDecorations } from "./decorations.js";
import { cssValue, escapeAttr, escapeHtml, styleOf } from "./escape.js";
import { fontsLink } from "./fonts.js";
import { expandTiers, snakeLayout } from "./layout.js";

export interface RenderOptions {
  readonly css?: "inline" | "none";
  readonly fonts?: boolean;
}
export type { ColumnScale, RenderContext } from "./cells.js";
export { fontsLink } from "./fonts.js";
export type { GoogleFont } from "../themes/tokens.js";

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
  await loadTeamNames(leaguesOf(spec));
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

/**
 * A table as one HTML string, synchronously: the theme as a scoped `<style>` (with `css: "none"` the host page emits
 * `styleSheet(spec)` once instead), then the table. Cells that read league data (logos, team names) need
 * `await prepare(spec)` first, or use `renderHTMLAsync`. Throws `TableSpecError` for a column the rows lack or an
 * unknown theme.
 *
 * @example
 * ```ts
 * import { defineTable } from "@sportsdataverse/sdvtables";
 * import { renderHTML } from "@sportsdataverse/sdvtables/html";
 *
 * const rows = [
 *   { team: "BUF", pf: 525, pa: 368 },
 *   { team: "DEN", pf: 425, pa: 311 },
 *   { team: "LAC", pf: 402, pa: 301 },
 * ];
 * const spec = defineTable<(typeof rows)[number]>()
 *   .columns((c) => [c.text("team"), c.int("pf", { label: "Points for" }), c.int("pa", { label: "Points against" })])
 *   .theme("athletic")
 *   .build();
 * renderHTML(spec, rows);
 * ```
 */
export function renderHTML<Row>(
  input: TableSpec<Row>,
  rows: readonly Row[],
  opts: RenderOptions = {},
): string {
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
  const scales = columnScales(spec, rows, warn);
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
  const visible = spec.columns.filter((c) => !deco.hiddenColumns.has(c.key));
  const ncol = visible.length;
  let head = visible
    .map(
      (c) =>
        `<th scope="col" class="sdvt-label sdvt-${escapeAttr(alignOf(c))}" data-col="${escapeAttr(c.key)}" data-kind="${escapeAttr(c.kind)}"${styleOf([c.width ? `width:${escapeAttr(cssValue(c.width, `column ${c.key} width`))}` : "", deco.labelStyle(c.key)])}>${deco.label(c, (deco.labelText.get(c.key) ?? labelOf(c)) + deco.labelSuffix(c.key))}${c.subheader ? `<span class="sdvt-subheader">${escapeHtml(c.subheader)}</span>` : ""}</th>`,
    )
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
    `<tr class="sdvt-row${striped && shown++ % 2 === 1 ? " sdvt-stripe" : ""}${deco.rowClass(i)}" data-row="${i}"${styleOf([deco.rowStyle(i)])}>${cells}</tr>`;
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
  const caption = deco.caption ? `<caption>${deco.caption}</caption>` : "";
  const foot =
    deco.foot.length > 0
      ? `<tfoot>${deco.foot.map((f) => `<tr><td colspan="${ncol}">${f}</td></tr>`).join("")}</tfoot>`
      : "";
  const shared = opts.css === "none" ? "" : `<style>${styleSheet(spec, theme)}</style>`;
  const own = deco.css.length > 0 ? `<style>${deco.css.join("\n")}</style>` : "";
  const css = shared + own;
  const fonts: GoogleFont[] = [...theme.fonts, ...deco.fonts];
  const link = opts.fonts === false ? "" : fontsLink(fonts); // css:"none" drops only the shared theme sheet (A98, A100)
  const name = escapeAttr(spec.theme.name);
  return `${link ? `${link}\n` : ""}<div class="sdvt sdvt-theme-${name} ${themeKey(spec.theme)}" id="${escapeAttr(id)}" data-sdvt-theme="${name}" data-sdvt-density="${escapeAttr(spec.theme.density)}">${css}${deco.before}<table>${caption}<thead>${deco.headRows}<tr>${head}</tr></thead><tbody>${body.join("")}</tbody>${foot}</table>${deco.after}</div>`;
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
  // the fonts <link> goes to <head> once per href (A100), so the theme fonts load without a duplicate per table
  const link = t.content.querySelector("link");
  const href = link?.getAttribute("href");
  if (
    link &&
    href &&
    !Array.from(document.head.querySelectorAll("link")).some((l) => l.getAttribute("href") === href)
  )
    document.head.append(link);
  return el;
}
/**
 * gt_theme_preview (_themes.py:2058-2064): one HTML string per theme, first n rows, compact; sdvTeam shown with
 * league nfl and no team.
 *
 * @example
 * ```ts
 * import { defineTable } from "@sportsdataverse/sdvtables";
 * import { themePreview } from "@sportsdataverse/sdvtables/html";
 *
 * const rows = [
 *   { team: "KC", wins: 15, losses: 2 },
 *   { team: "BUF", wins: 13, losses: 4 },
 * ];
 * const spec = defineTable<(typeof rows)[number]>()
 *   .columns((c) => [c.text("team"), c.int("wins"), c.int("losses")])
 *   .build();
 * Object.values(themePreview(spec, rows, ["sdv", "athletic", "midnight"])).join("\n");
 * ```
 */
export function themePreview<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  themes?: readonly string[],
  o: { n?: number; density?: Density } = {},
): Record<string, string> {
  const n = o.n ?? 5;
  if (!Number.isInteger(n) || n < 1) throw new TableSpecError(`n must be a positive whole number, got ${n}`);
  const out: Record<string, string> = {};
  for (const name of themes ?? THEME_NAMES)
    out[name] = renderHTML(
      {
        ...spec,
        theme: {
          name,
          density: o.density ?? "compact",
          ...(name === "sdvTeam" ? { options: { league: "nfl" } } : {}),
        },
      },
      rows.slice(0, n),
    );
  return out;
}
export { labelOf as columnLabel };
