---
title: sdvplot-js notebooks
toc: false
---

# sdvplot-js notebooks

Twelve live notebooks that run the sdvplot-js packages in your browser: `@sportsdataverse/sdvplot` for team identity, shot charts, linking and chart-library adapters, `@sportsdataverse/sporty` for playing surfaces, and `@sportsdataverse/sdvtables` for tables. Each control re-runs only the cells that read it, and every chart draws real data: the bundled team index (one league at a time, loaded on demand), the 2024 NFL season from nflverse, Brooklyn's 2025-26 shots against the whole league, and single games from stats.nba.com, the NHL, the PWHL and ESPN. The last five start from ESPN through sportsdataverse-js and can fetch today's data.

## Identity

- [Logos by league](./logos.html): every team's logo or wordmark for a league and season, one franchise across its eras, logos as the marks of a Plot chart and on its axis, linked to a table by `id`, and player headshots.
- [Team colours](./colors.html): a league's palette, `matchupColors` for two teams that clash with the contrast of each colour, and a team-coloured chart on a light or a dark page.

## Surfaces

- [Playing surfaces](./surfaces.html): sporty's courts, fields, rinks and pitches for nine sports, each rule set, display range and rotation; a surface in a team's colours; and real NBA, NHL, PWHL and NFL events moved onto them with `toSurfaceFrame`.

## Shot charts

- [Shot charts](./shots.html): Brooklyn's shots in hexagons, squares or zones against the league, with a four-line tooltip, the shooting signature, and attempts by distance and side on one shared cursor, as blazing-the-nets draws them.

## Tables

- [Tables](./tables.html): one table spec under every sdvtables theme and density, its column kinds and decorations, and the engine that sorts, filters, pages and selects once the HTML is hydrated.

## Linking

- [Linked interactivity](./linked.html): one selection store driving a brushable scatter and a hydrated table in both directions, a cursor shared by two charts, `nearestHover` and `tooltip`, and a strip of games used as checkboxes.

## Chart libraries

- [Chart libraries](./libraries.html): the same data through the Plotly, Vega-Lite, ECharts and Chart.js adapters, with logos as points, logos on an axis, and each library's own tooltips.

## Workflows with sdv-js

Five pages that start from ESPN data fetched with [sportsdataverse-js](https://js.sportsdataverse.org) and end at a chart or a table someone would publish. Each draws a committed snapshot (its URL, capture time and sha256 are on the page) and has a **Fetch live from ESPN** toggle: tick it and your browser fetches today's data from ESPN and parses it with sdv-js's own parser.

- [Live scoreboard](./scoreboard.html): today's games for six leagues as cards in each matchup's colours, from `matchupColors` and `onColor`.
- [Win-probability scrubber](./win-probability.html): an NFL or college football game's win probability, play by play, with a scrubber, the nearest play on hover, and the plays that swung it most.
- [Build your own game dashboard](./game-dashboard.html): one NBA or WNBA game's shots on a court, linked to its box score; the athlete-id join is checked before it is made.
- [Season ratings scatter](./ratings.html): every NBA team's points scored and allowed per game as logos with mean lines, and tiers by point differential.
- [Player trend explorer](./player-trend.html): a player's game log with a rolling average, a brushed date window and that window's averages.

Each page links to its source. The pages import the packages from `./_sdv/`, a bundle of their source made at build time; your own code imports `@sportsdataverse/sdvplot`, `@sportsdataverse/sporty` and `@sportsdataverse/sdvtables` by name. The <a href="/" rel="external">documentation</a> has the guides, the gallery and the API reference.
