# @sportsdataverse/sdvtables

Serializable table specs rendered to static HTML with SportsDataverse team identity and themes. A `TableSpec` is plain
data (JSON-safe), so the same spec renders in Node, the browser and notebooks. Zero runtime dependencies beyond
[`@sportsdataverse/sdvplot`](https://plot.sportsdataverse.org) (team logos, headshots and colors).

Docs: https://plot.sportsdataverse.org. Siblings: sdvplot (Python, `great_tables` helpers) and sdvplotR (R, `gt_*`). This package ports both; the name map is [below](#gtutils--sdvplotr-names).

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
import { styleSheet, themeKey } from "@sportsdataverse/sdvtables/html";
// one <style> per distinct themeKey(spec.theme), then:
renderHTML(spec, rows, { css: "none" });
```

Decoration CSS is scoped to the table `#id`. Two renders of the same spec on one page therefore need distinct ids:
call `.id("a")` / `.id("b")` on the builder.

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
