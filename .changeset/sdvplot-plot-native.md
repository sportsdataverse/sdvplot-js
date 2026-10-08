---
"@sportsdataverse/sdvplot": minor
"@sportsdataverse/sporty": minor
---

Plot-native marks and interactivity (J39-J42).

- **Open image marks.** `logos`, `wordmarks` and `headshots` compute only the image URL, its size and skip-and-warn; every other Observable Plot image option passes through (`tip`, `href`/`target`, `title`, `fx`/`fy`, `sort`/`filter`/`reverse`, `dx`/`dy`, `className`, `clip`, `opacity`, `channels`). Plot's row-preserving transforms wrap them (`dodgeY`/`dodgeX` beeswarms, `stackY`, `windowY`, `selectLast`, `pointer`); a transform that makes new rows (`bin`, `group`, `hexbin`) throws `InputError`. A caller's `render`, `transform` and `initializer` are composed with sdvplot's, never replaced (`Plot.pointer` stays outermost). New option types `ImageMarkOptions` and `ImagePassThrough`.
- **Tips, opt-in.** `tip: true` adds Plot's own tip, and the pointed row is the figure's `value` (with an `input` event). Defaults: the team or player id on the image marks; attempts, FG%, league FG% and the shrunk difference on `shotCells`; the zone, plus makes/attempts and FG% given the new `stats` option, on `shotZones`; distance, FG%, league FG% and share on `shootingSignature` (new `tip` option). A tip object's `format` merges over sdvplot's key by key. Server rendering adds only an empty tip group.
- **Accessible names everywhere.** Every image is named by its subject ("KC logo", "KC wordmark", "3139477 headshot"), by the resolved team whatever id system the rows use (`team_id` included): the Plot image marks and `axisLogos`, the Vega image layers and `withAxisLogos`, and d3's `appendLogos`/`appendWordmarks`/`appendHeadshots` (new `ariaLabel` accessor option). `shotZones` names each path by its zone, a titled `teamTiers` figure is labelled by its title, and sporty's `surfaceMark` takes an `ariaDescription` (default "nba basketball surface" and so on). The README says where Plotly, ECharts and Chart.js charts get their accessible name.
- **Shot marks.** `shotCells` and `shotZones` draw the caller's `cells` and `areas` as the mark's data and take Plot's geo options (`GeoPassThrough`: `fx`/`fy`, `channels`, `title`, `href`, `clip`, ...). A zone's tip anchors on points inside the zone, so the C-shaped mid-range is reachable.
- **Pass-through on `axisLogos`, `meanLines`/`medianLines` and `teamTiers`.** `axisLogos` takes Plot's axis options (`AxisPassThrough`; a caller's margin on the anchored side wins), the reference lines take Plot's rule options (`RuleLinePassThrough`, so `fx`/`fy` give a mean per facet), and `teamTiers` takes `tip`.
- `drawnMarks` (`sdvplot/testing`) reports a Plot image's x and y as the data value behind the channel: `null` where a transform such as `dodgeY` computed the position, and a Date as its time in ms.

Breaking, before the first publish (so declared here, not as a major bump):

- `shotCells`' `clip` is renamed `dropOutside`, so Plot's own `clip` passes through.
- Image marks: `x` and `y` are Plot channel specs and optional (a transform such as `dodgeY` may supply `y`); `title` is Plot's channel; `ariaLabel` is Plot's per-image channel, so a string is a column name (the old string option named nothing); `alpha` together with `opacity` throws `InputError`; `r` is the dodge collision radius and never clips or sizes an image.
- `ShotCellsOptions.stroke` and `strokeWidth`, and `ShotZonesOptions.fillOpacity`, widen to Plot channel specs.
- A `shotCells` or `shotZones` path's datum is now its index in the caller's input, not a built feature (draw order is unchanged).
