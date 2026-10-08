---
title: Logos by league
---

# Logos by league

Team identity from the bundled index: logos and wordmarks by league and season, one franchise across its eras, logos as the data marks of a chart and on its axis, and player headshots. Every chart below draws real data: the bundled team index, nflverse's 2024 regular season and the 2024 AFC standings.

```js
import * as Plot from "@observablehq/plot";
import {
  LEAGUES,
  createSelection,
  loadLeague,
  logoUrlSync,
  marks,
  setWarningHandler,
  teams,
} from "./_sdv/sdvplot.js";
import { axisLogos, headshots, logos, meanLines, medianLines, teamColor, wordmarks } from "./_sdv/sdvplot-plot.js";
import { linkSelection } from "./_sdv/interact.js";
import { createTable, defineTable } from "./_sdv/sdvtables.js";
import { hydrate, prepare, renderHTML } from "./_sdv/sdvtables-html.js";
import { note, range, scroller, select } from "./components/controls.js";
```

## Every team in a league

Pick a league and a season: the page loads that league's shard only. **Mark** switches between the logo and the wordmark, and **Variant** between the default mark and the one drawn for a dark background (shown on a dark panel, so you can see why it exists). A team with no archived mark for that choice is left out; the count below the grid says how many.

```js
const league = view(select(LEAGUES, { label: "League", value: "nfl" }));
const season = view(range([1960, 2026], { label: "Season", value: 2024 }));
const markType = view(select(["logo", "wordmark"], { label: "Mark", value: "logo" }));
const variant = view(select(["default", "dark"], { label: "Variant", value: "default" }));
```

```js
// sdvplot warns (once per team) when it has no mark for a team; the count below says the same, so keep the console quiet
setWarningHandler(() => {});
invalidation.then(() => setWarningHandler(null));
const all = await teams(league);
const rows = all
  .map((t) => ({ name: t.name ?? t.team_id, src: logoUrlSync(t.team_id, league, { season, markType, variant }) }))
  .filter((t) => t.src !== undefined);
```

```js
const wide = markType === "wordmark";
const cols = Math.max(3, Math.floor(width / (wide ? 120 : 72)));
display(
  rows.length === 0
    ? note(`No ${league} team has an archived ${markType} for ${season}.`)
    : Plot.plot({
        width,
        height: 30 + (wide ? 56 : 72) * Math.ceil(rows.length / cols),
        axis: null,
        // the variant's own background: a dark mark is made to sit on a dark field
        style: { background: variant === "dark" ? "#181a1b" : "#ffffff", borderRadius: "6px" },
        x: { type: "point", domain: Array.from({ length: cols }, (_, i) => i) },
        y: { type: "point" },
        marks: [
          Plot.image(rows, {
            x: (_, i) => i % cols,
            y: (_, i) => Math.floor(i / cols),
            src: "src",
            title: "name",
            width: wide ? 104 : 52,
            height: wide ? 40 : 52,
          }),
        ],
      }),
);
```

${rows.length} of ${all.length} ${league} teams have a ${variant} ${markType} for ${season}.

## One franchise across its eras

`marks(team, league)` lists every archived mark of a team with the seasons it was used. A relocated or rebranded franchise keeps one `team_id`, so its history stays in one place: the Utah Mammoth below are also the Winnipeg Jets of 1980 and the Phoenix and Arizona Coyotes. Pick another team; the default is the team in the league with the most logo eras.

```js
const eraLeague = view(select(["nhl", "nfl", "nba", "mlb", "wnba"], { label: "League", value: "nhl" }));
```

```js
const eraData = await loadLeague(eraLeague);
const eraCount = (id) =>
  new Set(
    eraData.marks
      .filter((m) => m.team_id === id && m.mark_type === "logo" && m.variant === "default" && m.valid_from !== null)
      .map((m) => m.valid_from),
  ).size;
const eraTeams = eraData.teams.filter((t) => t.name).sort((a, b) => eraCount(b.team_id) - eraCount(a.team_id));
const eraTeam = view(
  select(
    eraTeams.map((t) => t.name),
    { label: "Team", value: eraTeams.find((t) => t.abbr === "UTAH")?.name ?? eraTeams[0].name },
  ),
);
```

```js
const eraId = eraTeams.find((t) => t.name === eraTeam).team_id;
// one row per first season, the best-ranked source first; undated rows are the current fallback
const eraMarks = await marks(eraId, eraLeague);
const eras = [];
for (const m of [...eraMarks]
  .filter((m) => m.mark_type === "logo" && m.variant === "default" && m.valid_from !== null)
  .sort((a, b) => a.valid_from - b.valid_from || a.source_rank - b.source_rank))
  if (!eras.some((e) => e.valid_from === m.valid_from))
    eras.push({ ...m, label: m.valid_to === m.valid_from ? `${m.valid_from}` : `${m.valid_from}–${m.valid_to ?? ""}` });
const eraCols = Math.max(2, Math.min(eras.length, Math.floor(width / 96)));
display(
  eras.length === 0
    ? note(`${eraTeam} has one undated logo in the index.`)
    : Plot.plot({
        width,
        height: 20 + 104 * Math.ceil(eras.length / eraCols),
        axis: null,
        style: { background: "#ffffff", color: "#222", borderRadius: "6px" },
        x: { type: "point", domain: Array.from({ length: eraCols }, (_, i) => i) },
        y: { type: "point" },
        marks: [
          Plot.image(eras, {
            x: (_, i) => i % eraCols,
            y: (_, i) => Math.floor(i / eraCols),
            src: "archive_url",
            width: 60,
            dy: -10,
            title: "label",
          }),
          Plot.text(eras, { x: (_, i) => i % eraCols, y: (_, i) => Math.floor(i / eraCols), text: "label", dy: 34 }),
        ],
      }),
);
```

## Logos as data marks

`logos()` from `@sportsdataverse/sdvplot/plot` is an Observable Plot mark: each team is drawn as its logo at an (x, y), and the rest of Plot works as usual. On a dark page the chart asks for each team's `dark` variant: eight teams have one for 2024 (Dallas, Denver, Green Bay, Las Vegas, the Rams, Minnesota and both New York teams), and the rest keep their default logo. Here is every NFL team's 2024 EPA per play: what its offence gained (x) and what its defence allowed (y, reversed, so up is better). **Logo height** is a fraction of the chart's height. **Reference lines** draws the league mean or median on both axes. Hover a logo for Plot's tip.

```js
// nflverse play_by_play_2024, rush or pass plays with an EPA (examples/src/data.ts gives the source)
const epa = (await FileAttachment("data/nfl_epa_2024.json").json()).map((t) => ({
  team: t.team,
  offense: t.off_epa / t.off_plays,
  defense: t.def_epa / t.def_plays,
  net: t.off_epa / t.off_plays - t.def_epa / t.def_plays,
}));
await loadLeague("nfl");
```

```js
const logoHeight = view(range([0.04, 0.12], { label: "Logo height", step: 0.01, value: 0.07 }));
const refLines = view(select(["means", "medians", "none"], { label: "Reference lines", value: "means" }));
// one store for the chart and the table below it: a hover or a selection in one shows in the other
const epaStore = createSelection();
```

```js
const epaChart = Plot.plot({
  width,
  height: Math.min(560, Math.max(360, width * 0.7)),
  grid: true,
  inset: 24, // room for the logos at the edges
  x: { label: "Offensive EPA/play →", tickFormat: "+.2f" },
  y: { label: "↑ Defensive EPA/play allowed (reversed)", reverse: true, tickFormat: "+.2f" },
  marks: [
    refLines === "means" ? meanLines(epa, { x: "offense", y: "defense" }) : null,
    refLines === "medians" ? medianLines(epa, { x: "offense", y: "defense", stroke: "steelblue" }) : null,
    logos(epa, {
      league: "nfl",
      x: "offense",
      y: "defense",
      team: "team",
      // on a dark page, each team's mark for a dark background where it has one
      variant: dark ? "dark" : "default",
      height: logoHeight,
      // the link id the table's rowKey also reads, so a logo and its row are the same id
      id: "team",
      tip: { format: { x: "+.3f", y: "+.3f" } },
    }),
  ],
});
// re-linked whenever the chart is redrawn (a new width, a new logo height); the old link goes with the old chart
invalidation.then(linkSelection(epaStore, { figure: epaChart }));
display(epaChart);
```

The `id: "team"` option stamps each logo with its team's abbreviation, the same value the table's `rowKey` reads. That is all the linking needs: hover a row to light its logo, hover a logo to underline its row, and click rows to select them (the other logos dim). Sort by any column, search, or page through the 32 teams; the chart follows the table's selection.

```js
const epaSpec = defineTable()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true, label: "Team" }),
    c.num("offense", { label: "Offence", digits: 3, forceSign: true }),
    c.num("defense", { label: "Defence", digits: 3, forceSign: true }),
    c.num("net", { label: "Net", digits: 3, forceSign: true }),
  ])
  .title("NFL EPA per play, 2024 regular season")
  .subtitle("Offence gained, defence allowed; net = offence minus defence")
  .rowKey("team")
  .build();
await prepare(epaSpec);
const epaTable = createTable(epaSpec, epa, { pageSize: 8, sort: { col: "net", dir: "desc" } });
const epaHost = document.createElement("div");
epaHost.innerHTML = renderHTML(epaTable);
hydrate(epaHost.querySelector(".sdvt"), epaTable);
invalidation.then(linkSelection(epaStore, { table: epaTable }));
display(scroller(epaHost));
```

## Logos on an axis

`axisLogos("y")` replaces the y axis's tick labels with logos; a value that resolves to no team keeps its text. The bars take each team's colour from `teamColor`. **Rank by** re-sorts the same 32 teams.

```js
const metric = view(select(["net", "offense", "defense"], { label: "Rank by", value: "net" }));
```

```js
display(
  Plot.plot({
    width,
    height: 32 * 22 + 40,
    marginLeft: 44,
    x: { label: `${metric === "defense" ? "Defensive EPA/play allowed" : metric === "offense" ? "Offensive EPA/play" : "Net EPA/play"} →`, tickFormat: "+.2f", grid: true },
    y: { label: null },
    color: teamColor("nfl", { values: epa.map((t) => t.team) }),
    marks: [
      // a defence is better the less it allows, so that ranking runs the other way
      Plot.barX(epa, {
        x: metric,
        y: "team",
        fill: "team",
        // a thin outline keeps a navy or black team colour visible on a dark page
        stroke: dark ? "#8a8a8a" : null,
        strokeWidth: 0.6,
        sort: { y: metric === "defense" ? "x" : "-x" },
      }),
      axisLogos("y", { league: "nfl", height: 0.026, variant: dark ? "dark" : "default" }),
      Plot.ruleX([0]),
    ],
  }),
);
```

## Headshots and wordmarks

`headshots()` draws a player's headshot from an ESPN athlete id with no league data at all. Here are the eight AFC West and East starting quarterbacks of 2024 at their team's points for and against. `wordmarks()` draws a team's wordmark, here past the end of each bar.

```js
// 2024 regular season (nflverse); qb is each team's most frequent starter, qb_espn_id his ESPN id
const standings = await FileAttachment("data/standings.json").json();
await loadLeague("nfl"); // wordmarks resolves the teams synchronously
```

```js
display(
  Plot.plot({
    width,
    height: Math.min(460, Math.max(300, width * 0.6)),
    grid: true,
    inset: 44,
    x: { label: "Points for →" },
    y: { label: "↑ Points against (reversed)", reverse: true },
    marks: [
      headshots(standings, { league: "nfl", x: "pf", y: "pa", player: "qb_espn_id", title: "qb", height: 0.16 }),
      // names under the faces where there is room; on a phone they would overlap (each face still has its title)
      width >= 600 ? Plot.text(standings, { x: "pf", y: "pa", text: "qb", dy: 38, fontSize: 11 }) : null,
    ],
  }),
);
```

```js
display(
  Plot.plot({
    width,
    height: 300,
    marginLeft: 40,
    // most wordmarks are dark ink and none has a dark variant: a light panel keeps them readable on a dark page
    style: { background: "#ffffff", color: "#222222", borderRadius: "6px" },
    x: { label: "Wins →", domain: [0, 20] },
    y: { label: null },
    marks: [
      Plot.barX(standings, { x: "wins", y: "team", fill: "#bbb", sort: { y: "-x" } }),
      wordmarks(standings, { league: "nfl", x: (s) => s.wins + 2, y: "team", team: "team", height: 0.08 }),
      Plot.ruleX([0]),
    ],
  }),
);
```
