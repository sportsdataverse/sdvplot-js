# @sportsdataverse/sdvtables

Serializable table specs rendered to static HTML with SportsDataverse team identity and themes. A `TableSpec` is plain
data (JSON-safe), so the same spec renders in Node, the browser and notebooks. Zero runtime dependencies beyond
[`@sportsdataverse/sdvplot`](https://plot.sportsdataverse.org) (team logos, headshots and colors).

Docs: https://plot.sportsdataverse.org. Siblings: sdvplot (Python, `great_tables` helpers) and sdvplotR (R, `gt_*`). This package ports both; the name map is [below](#gtutils--sdvplotr-names).

## Install

```sh
npm install @sportsdataverse/sdvtables @sportsdataverse/sdvplot
```

ESM only, Node >= 20.18.1. `@sportsdataverse/sdvplot` is a required peer (npm 7+ and pnpm install it for you).

## Quick start

```ts
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML, toElement } from "@sportsdataverse/sdvtables/html";

const spec = defineTable<{ team: string; wins: number }>()
  .columns((c) => [c.logo("team", { league: "nfl", includeName: true }), c.int("wins")])
  .theme("midnight")
  .title("AFC West")
  .build();

await prepare(spec); // loads leagues, team names and gsis ids the spec needs
const html = renderHTML(spec, rows); // string (Node, SSR, notebooks)
document.body.append(toElement(spec, rows)); // browser; Observable: html`${renderHTML(spec, rows)}`
```

`prepare(spec)` must be awaited before `renderHTML`. `renderHTMLAsync` does both.

## Hosts and CSS

Every themed value is a `--sdvt-*` custom property on the table wrapper, and each element carries at most one
`style` attribute. By default `renderHTML` inlines a scoped `<style>` block. A page that renders many tables should
emit the stylesheet once per theme and render the tables with `css: "none"`:

```ts
import { renderHTML, styleSheet, themeKey } from "@sportsdataverse/sdvtables/html";
const seen = new Set<string>();
const parts = specs.map((spec) => {
  const key = themeKey(spec.theme);
  const sheet = seen.has(key) ? "" : `<style>${styleSheet(spec)}</style>`; // once per themeKey
  seen.add(key);
  return sheet + renderHTML(spec, rows, { css: "none" });
});
```

`css: "none"` drops only the shared theme sheet. Each table still carries its own `#id`-scoped decoration `<style>`
and the Google Fonts `<link>` for its theme and `.font()` faces; pass `fonts: false` to drop the link and load the
fonts yourself (`fontsLink(fonts)` builds the same tag). `toElement` moves the link into `document.head`, once per URL.

Decoration CSS is scoped to the table `#id`. Two renders of the same spec on one page therefore need distinct ids:
call `.id("a")` / `.id("b")` on the builder.

## TanStack Table interop (recipe)

sdvtables has its own headless engine and takes no TanStack dependency. If your app already renders tables with
`@tanstack/react-table` 8, map a `TableSpec` to `ColumnDef`s: the header comes from the spec, and each
cell reuses the markup `renderHTML` draws (logos, pills, bars), read back from `toElement()` by `data-row` / `data-col`.
Sorting uses the spec's `sortable` and `compare`, the [Phase 5 fields](#reserved-for-phase-5): a column without
`compare` falls back to TanStack's default sort, and `compare` stays ascending because TanStack inverts it for
descending itself.

`toElement` needs a `document`, and a `"use client"` component is still server-rendered in Next, so build the columns
only after mount: in a `useEffect` (below), or load the table component with `next/dynamic(..., { ssr: false })`.

```tsx
import type { TableSpec } from "@sportsdataverse/sdvtables";
import { columnLabel, toElement } from "@sportsdataverse/sdvtables/html";
import type { ColumnDef } from "@tanstack/react-table";

/** sdvtables columns -> TanStack column defs. Cells reuse renderHTML's own markup (logos, pills, bars); wrap the
 *  table in `<div className={themeKey(spec.theme)}>` and emit `<style>{styleSheet(spec)}</style>` once. */
export function toTanStackColumns<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
): ColumnDef<Row, unknown>[] {
  const cells = new Map<string, Element>(); // "row|col" -> sdvtables' <td>
  // needs a DOM (throws TableSpecError without a document): call this after mount, never during render
  for (const td of Array.from(toElement(spec, rows).querySelectorAll("tr[data-row] > td[data-col]")))
    cells.set(`${td.parentElement?.getAttribute("data-row")}|${td.getAttribute("data-col")}`, td);
  return spec.columns.map(
    (c): ColumnDef<Row, unknown> => ({
      id: c.key,
      accessorFn: (row) => row[c.key],
      header: columnLabel(c),
      enableSorting: c.sortable !== false,
      ...(c.compare ? { sortingFn: (a, b, id) => c.compare?.(a.getValue(id), b.getValue(id)) ?? 0 } : {}),
      cell: (ctx) => {
        const cell = cells.get(`${ctx.row.index}|${c.key}`); // row.index is the input order, as data-row is
        // pill / rank fills live on sdvtables' own <td style>, so carry that over too
        return (
          <div
            ref={(n) => n?.setAttribute("style", cell?.getAttribute("style") ?? "")}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sdvtables escapes every value it renders
            dangerouslySetInnerHTML={{ __html: cell?.innerHTML ?? "" }}
          />
        );
      },
    }),
  );
}
```

```tsx
"use client";
import type { TableSpec } from "@sportsdataverse/sdvtables";
import { prepare, styleSheet, themeKey } from "@sportsdataverse/sdvtables/html";
import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { type ReactElement, useEffect, useState } from "react";
import { toTanStackColumns } from "./to-tanstack-columns"; // the first fence

export function StandingsTable<Row>({ spec, rows }: { spec: TableSpec<Row>; rows: Row[] }): ReactElement {
  // empty on the server and on the first client render; filled once the effect has run
  const [columns, setColumns] = useState<ColumnDef<Row, unknown>[]>([]);
  useEffect(() => {
    let live = true;
    void prepare(spec).then(() => {
      if (live) setColumns(toTanStackColumns(spec, rows));
    });
    return () => {
      live = false;
    };
  }, [spec, rows]);

  const table = useReactTable({
    data: rows, // keep this reference stable: a new array every render makes TanStack loop
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div className={themeKey(spec.theme)}>
      <style>{styleSheet(spec)}</style>
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Limits: `snake` and tier layouts change which `<tr>` holds which row, so the recipe covers plain specs; table-level
decorations (title, caption, stripes) are not cells and are not carried over. Written for `@tanstack/react-table` 8
(sdv-web pins `^8.21.3`); v9 is a breaking major and is not covered.

## Themes

20 themes: the 18 gtUtils themes plus `sdv` (light/dark) and `sdvTeam`. Set one with
`.theme(name, { density, options })`.

| Theme | Options | Default density |
|---|---|---|
| `sdv` | `style` (`light`/`dark`) | comfortable |
| `sdvTeam` | `league` (required), `team` | comfortable |
| `almanac` | `accent`, `stripe` (`"none"` for no banding) | compact |
| `broadsheet` | `accent`, `paper` | comfortable |
| `drench` | `color` | comfortable |
| `sofa`, `tier` | `style` | comfortable |
| `scoreboard`, `terminal` | `accent` | compact |
| `booktabs`, `brutalist`, `midnight`, `swiss`, `tufte` | `accent` | comfortable |
| `athletic`, `gtutils`, `kenpom`, `ncaa`, `pl`, `savant` | none | comfortable |

| Density | body | padding | title | subtitle | label | group | source |
|---|---|---|---|---|---|---|---|
| `comfortable` | 14 | 6 | 26 | 15 | 10 | 11 | 11 |
| `compact` | 12 | 3 | 22 | 13 | 9 | 10 | 10 |
| `social` | 17 | 9 | 34 | 19 | 12 | 13 | 13 |

`themePreview(spec, rows, themes?, { n, density })` from `@sportsdataverse/sdvtables/html` returns
`Record<themeName, html>` (first `n` rows, compact).

## Surface

- 21 column kinds on the `c` factory (`text`, `num`, `int`, `pct`, `rank`, `delta`, `tally`, `logo`, `wordmark`,
  `headshot`, `colorPills`, `colorRanks`, `colorResults`, `percentileBar`, `indicatorBox`, `highlight`,
  `highlightNa`, `mergeStackTeamColor`, `teamColorBar`, `teamColorBg`, `image`; `fmtRank`/`fmtTally` alias
  `rank`/`tally`).
- 25 table decorations as builder methods (titles, legends, cutlines, row accents, snake layout, tiers, watermark, ...).
- Conditions are data predicates (`{ key, op, value }`), not callbacks, so specs stay serializable.
- Number cells display negatives with U+2212 (a true minus); `formatValue`-style labels (legends, notes) stay ASCII.
- Unknown team ids warn once per call per set and render as plain text.

## Reserved for Phase 5

Accepted and ignored by `renderHTML` today; do not rely on behavior yet.

- `sortable`, `filterable` and `compare(a, b)` on a column. `compare` is the one non-serializable field and is
  dropped by `JSON.stringify`.
- `TableSpec.interactive.pageSize`.
- Markup hooks the interactive engine will target: wrapper `id="sdvt-..."` with `data-sdvt-theme` and
  `data-sdvt-density`, `<th data-col data-kind>`, `<tr data-row>` (index into `rows`), `<td data-col>`.

## gtUtils / sdvplotR names

All 74 sdvplotR `gt_*` / `pal_*` / `reactable_sdv_*` exports map as below (`GT_ALIASES` and `aliasFor(name)` expose
the same table in code). Builder methods are on `defineTable()`, `c.*` inside `.columns(c => [...])`.

| sdvplotR / gtUtils | sdvtables | status |
|---|---|---|
| `gt_sdv_logos` | `c.logo(key, {league, includeName, season, variant, height})` | ported |
| `gt_sdv_wordmarks` | `c.wordmark(key, {league, season, variant, height})` | ported |
| `gt_sdv_headshots` | `c.headshot(key, {league, idSystem, height})` | ported |
| `gt_sdv_cols_label` | image labels are Phase 5 (`labelHtml`); today use `.titleHeader()` or `subheader` | not ported (labels are text) |
| `gt_merge_stack_team_color` | `c.mergeStackTeamColor(top, stack, team, {league, fontSizeTop, fontSizeBottom, color, background})` | ported |
| `gt_theme_sdv` / `gt_theme_sdv_team` | `.theme("sdv", {options:{style}})` / `.theme("sdvTeam", {options:{league, team}})` | ported |
| `gt_theme_<name>` (18) | `.theme("<name>", {density, options:{accent\|stripe\|paper\|color\|style}})` | ported |
| `gt_theme_preview` | `themePreview(spec, rows, themes?, {n, density})` from `/html` | ported (dict of HTML, not a grid) |
| `pal_midnight` | `PAL_MIDNIGHT` (`["#5B8DEF","#3FBF87","#E8E9ED","#9498A3","#24272E"]`) | ported |
| `gt_538_caption` | `.caption538({top, bottom, ruleColor, ruleWidth, size, align})` | ported |
| `gt_bold_rows` | `.boldRows(rows, {textColor, highlightColor})` | ported |
| `gt_border_bars_top/bottom` | `.borderBars("top"\|"bottom", colors, {...})` | ported (bars outside the `<table>`) |
| `gt_border_grid` | `.borderGrid({color, weight, includeLabels})` | ported |
| `gt_color_pills` | `c.colorPills(key, {...})` | ported (sRGB ramp, as great_tables) |
| `gt_color_ranks` | `c.colorRanks(key, {palette, domain, reverse})` | ported |
| `gt_color_results` | `c.colorResults(key, {...})`: a column kind that fills its row by W/L/T | ported |
| `gt_column_subheaders` | the `subheader` option of every `c.*` kind | ported |
| `gt_cutline` | `.cutline(after, {label, color, weight, style, labelColor, labelSize, labelPosition, gap})` | ported |
| `gt_delta` | `c.delta(from, to, {...})` | ported |
| `gt_fmt_rank` / `gt_fmt_tally` | `c.rank` / `c.tally` (also `c.fmtRank` / `c.fmtTally`) | ported |
| `gt_group_stripes` | `.groupBy(key).groupStripes({color, start})` | ported |
| `gt_highlight_cells` | `c.highlight(key, predicate, {fill, textColor, bold})` | ported (data predicate, not a formula) |
| `gt_highlight_na` | `c.highlightNa(key, {...})` | ported |
| `gt_indicator_boxes` | `c.indicatorBox(key, {truthy, fill, neutral, size, showOnly})` | ported (value list, not a rule) |
| `gt_legend_continuous` / `gt_legend_discrete` (deprecated gtUtils names `gt_color_legend` / `gt_centered_legend`) | `.legendContinuous({...})` / `.legendDiscrete(key\|"recorded", {...})` | ported |
| `gt_marginalia` | `.marginalia(columns, {...})` | ported |
| `gt_outliers` | `.outliers(columns, {method, threshold, bounds, side, fill, color, bold, symbol, note})` | ported |
| `gt_percentile_bar` | `c.percentileBar(key, {...})` | ported |
| `gt_row_accent` | `.rowAccent(key, {palette, rows, width, side, hide, naColor})` | ported |
| `gt_scale_note` | `.scaleNote(columns, {divisor, note, where, labelSuffix, decimals})` | ported |
| `gt_set_font` | `.font(family, {google, weight, style})` | ported |
| `gt_significance` | `.significance(pairs, {levels, symbols, superscript, note})` | ported |
| `gt_snake` / `gt_snake_align` | `.snake({nCols, rowsPerCol, gap, fill, cleanGaps})` / `snakeAlign(rows, opts)` | ported |
| `gt_social_tag` | `.socialTag(accounts, {...})` | ported (inline Font Awesome 6 SVG) |
| `gt_spotlight` | `.spotlight(rows, {...})` | ported |
| `gt_tiers` | `.tiers(levels, tierKey, imageColumns, {colors, imgHeight, style})` | ported |
| `gt_title_header` | `.titleHeader(title, {subtitle, kicker, date, *Style})` | ported |
| `gt_watermark` | `.watermark({text, image, opacity, size, position, color, angle, font})` | ported |
| `gt_wrap_labels` | `.wrapLabels({columns, width, balance})` | ported |
| `gt_save_crop` / `gt_save_batch` | `tableToPNG` (`/export`) | Phase 5 |
| `gt_social_crop` | `socialCrop` (`/export`) | Phase 5 |
| `gt_grid` / `gt_stack_tables` | `gridTables` / `stackTables` (`/export`) | Phase 5 |
| `reactable_sdv_logos/wordmarks/headshots` | `c.logo` / `c.wordmark` / `c.headshot` | ported |
| `reactable_sdv_cols_label` | as `gt_sdv_cols_label` | not ported |
| `reactable_sdv_team_color_bar` / `_bg` | `c.teamColorBar(key, {league, which, naColor, barWidth})` / `c.teamColorBg(key, {league, which, alpha, naColor})` | ported |

## Known differences from Python and R

- Indicator boxes take a value list and carry no text; legends draw discrete steps, not a gradient bar.
- Tier images have an empty `alt`. `tally`'s column-mode share is not ported.
- `snake` keeps the first block's row styles for every block.
- A decoration's row fill always beats a kind's own cell background (Python's outcome depends on call order).
- `socialTag` accepts a fixed alias set (`x`/`twitter`, `ig`, `bsky`, `gh`, `yt`, `fb`, `web`/`website`/`link`,
  `email`/`mail`), not every Font Awesome name; `tiktok`, `threads` and `substack` are unavailable, as in faicons.
- `kicker` always renders uppercase; `cutline` y positions round half-up.
- `wrapLabels` keeps internal whitespace of a label as given.

## Data and licenses

Logos, headshots and team colors come from `@sportsdataverse/sdvplot`; the package makes no network requests of its
own beyond the optional Google Fonts `<link>` (`fonts: false` omits it). Social icons are Font Awesome Free 6 paths
(CC BY 4.0, https://fontawesome.com). MIT; see `NOTICE.md`.
