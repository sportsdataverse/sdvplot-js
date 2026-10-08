// src/html/index.ts — the public renderer entry; the body lives in parts.ts (Phase 5 Task 2).
import { loadGsis, loadLeague } from "@sportsdataverse/sdvplot";
import type { League } from "@sportsdataverse/sdvplot";
import type { Table } from "../engine.js";
import { TableSpecError } from "../errors.js";
import type { Density, TableSpec } from "../spec.js";
import { loadTeamNames } from "../team-name.js";
import { THEME_NAMES } from "../themes/index.js";
import { renderInteractive } from "./interactive.js";
import { type RenderOptions, assemble, labelOf, renderParts } from "./parts.js";

export type { ColumnScale, RenderContext } from "./cells.js";
export { fontsLink } from "./fonts.js";
export type { GoogleFont } from "../themes/tokens.js";
export type { RenderOptions, RenderedParts } from "./parts.js";
export {
  assemble,
  attrsText,
  fontsLinkFor,
  labelOf,
  renderParts,
  sortAria,
  styleSheet,
  tableHTML,
  themeKey,
} from "./parts.js";

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

function isTable<Row>(x: TableSpec<Row> | Table<Row>): x is Table<Row> {
  return typeof (x as Table<Row>).subscribe === "function";
}
/** Static markup from a spec, or the interactive document (toolbar, aria-sort headers, pager) from a `createTable` instance. */
export function renderHTML<Row>(table: Table<Row>, opts?: RenderOptions): string;
export function renderHTML<Row>(spec: TableSpec<Row>, rows: readonly Row[], opts?: RenderOptions): string;
export function renderHTML<Row>(
  a: TableSpec<Row> | Table<Row>,
  b?: readonly Row[] | RenderOptions,
  c: RenderOptions = {},
): string {
  if (isTable(a)) return renderInteractive(a, (b as RenderOptions | undefined) ?? {});
  return assemble(renderParts(a, (b as readonly Row[] | undefined) ?? [], c));
}
export { createTable } from "../engine.js";
export { handleClick, handleHover, handleInput, rowIdAt } from "./controls.js";
export {
  pagerLabel,
  renderInteractive,
  renderPager,
  renderToolbar,
  tableRenderOptions,
} from "./interactive.js";
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
/** gt_theme_preview (_themes.py:2058-2064): one HTML string per theme, first n rows, compact; sdvTeam shown with league nfl and no team. */
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
