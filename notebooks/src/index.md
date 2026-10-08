---
title: sdvplot-js notebooks
---

# sdvplot-js notebooks

Four live pages that run the sdvplot-js packages in the browser. Each control re-runs only the cells that read it, and every chart draws the repository's own data: the bundled team index (one league at a time, loaded on demand), the 2024 AFC standings, and the fourth-quarter shots of a real NBA game.

- [Logos by league](./logos.html): every team's logo for a league and season.
- [Team colours](./colors.html): a league's palette, and the contrast of any pair.
- [Playing surfaces](./surfaces.html): sporty's courts, fields and rinks, then one in a team's colours with real shots on it.
- [Table themes](./tables.html): the standings table under each sdvtables theme and density.

Each page links to its source. The pages import the packages from `./_sdv/`, a bundle of their source made at build time; your own code imports `@sportsdataverse/sdvplot`, `@sportsdataverse/sporty` and `@sportsdataverse/sdvtables` by name. The <a href="/" rel="external">documentation</a> has the guides, the gallery and the API reference.
