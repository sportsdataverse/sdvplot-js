---
title: sdvplot-js notebooks
toc: false
---

# sdvplot-js notebooks

Seven live notebooks that run the sdvplot-js packages in your browser: `@sportsdataverse/sdvplot` for team identity, shot charts, linking and chart-library adapters, `@sportsdataverse/sporty` for playing surfaces, and `@sportsdataverse/sdvtables` for tables. Each control re-runs only the cells that read it, and every chart draws real data: the bundled team index (one league at a time, loaded on demand), the 2024 NFL season from nflverse, Brooklyn's 2025-26 shots against the whole league, and single games from stats.nba.com, the NHL, the PWHL and ESPN.

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

Each page links to its source. The pages import the packages from `./_sdv/`, a bundle of their source made at build time; your own code imports `@sportsdataverse/sdvplot`, `@sportsdataverse/sporty` and `@sportsdataverse/sdvtables` by name. The <a href="/" rel="external">documentation</a> has the guides, the gallery and the API reference.
