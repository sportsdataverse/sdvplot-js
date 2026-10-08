---
title: Tables
---

# Tables

sdvtables builds a table once, as a spec, and renders it anywhere: to an HTML string here, to React, or to a PNG. This page shows the spec under each theme and density, the column kinds and decorations it can carry, and the headless engine that sorts, filters, pages and selects once the HTML is hydrated. Every value is from the 2024 NFL regular season (nflverse); `examples/src/data.ts` gives each column's source. Logos and quarterback headshots load from the sportsdataverse archive and ESPN.

```js
import { loadLeague, teamColorsSync } from "./_sdv/sdvplot.js";
import { THEME_NAMES, createTable, defineTable } from "./_sdv/sdvtables.js";
import { hydrate, prepare, renderHTML, renderHTMLAsync } from "./_sdv/sdvtables-html.js";
import { checkboxes, scroller, select } from "./components/controls.js";
```

```js
const standings = await FileAttachment("data/standings.json").json();
await loadLeague("nfl");
```

## Themes and densities

**Theme** picks one of the ${THEME_NAMES.length} registered themes and **Density** its row height (`social` is sized for an image post). The `sdvTeam` theme takes its header colours from a team: pick it with **sdvTeam colours**, which also colours the spotlight below. Wide tables scroll inside the column on a narrow screen.

```js
const theme = view(select(THEME_NAMES, { label: "Theme", value: "sdv" }));
const density = view(select(["comfortable", "compact", "social"], { label: "Density", value: "comfortable" }));
const team = view(select(standings.map((r) => r.team), { label: "sdvTeam colours", value: "KC" }));
```

## Column kinds and decorations

One spec, seven column kinds: a logo with the team name, a headshot, text, a W-L-T tally with the win share, a point-differential delta with arrows, colour pills for net EPA per play, and a league-wide SRS rank. New England's net EPA is blank on purpose, so you can see how a missing value renders. Tick **Decorations** to add or remove each one; the rows are sorted by wins, best first.

```js
const DECORATIONS = [
  "Group by division",
  "Spotlight the chosen team",
  "Row accent by division",
  "Playoff cutline",
  "Colour legend",
  "Source note",
];
const decorations = view(
  checkboxes(DECORATIONS, { label: "Decorations", value: ["Spotlight the chosen team", "Colour legend", "Source note"] }),
);
```

```js
const on = (d) => decorations.includes(d);
const byWins = [...standings].sort((a, b) => b.wins - a.wins || b.pf - b.pa - (a.pf - a.pa));
let builder = defineTable()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true }),
    c.headshot("qb_espn_id", { league: "nfl", label: "QB" }),
    c.text("qb", { label: "" }),
    c.tally(["wins", "losses", "ties"], { label: "Record", share: true, shareOf: 0 }),
    c.delta("pa", "pf", { label: "Point diff.", decimals: 0, arrows: true }),
    c.colorPills("net_epa", { label: "Net EPA/play", digits: 3, domain: [-0.2, 0.2] }),
    c.rank("srs_rank", { label: "SRS rank" }),
  ])
  // sdvTeam takes its header colour from a team; the other themes ignore the team.
  .theme(theme, theme === "sdvTeam" ? { density, options: { league: "nfl", team } } : { density })
  .title("AFC West and East, 2024")
  .subtitle(`theme "${theme}", density "${density}"`);
if (on("Group by division")) builder = builder.groupBy("division");
if (on("Spotlight the chosen team"))
  builder = builder.spotlight(
    { key: "team", op: "==", value: team },
    { fill: "#fff6d6", accentColor: teamColorsSync("nfl", team) ?? "#888" },
  );
if (on("Row accent by division")) builder = builder.rowAccent("division", { palette: { East: "#00338D", West: "#E31837" }, width: 6 });
if (on("Playoff cutline")) builder = builder.cutline(4, { label: ["Top four"] });
if (on("Colour legend")) builder = builder.legendContinuous({ title: "Net EPA per play", digits: 1 });
if (on("Source note"))
  builder = builder.sourceNote('Data: <a href="https://nflverse.nflverse.com">nflverse</a>, 2024 regular season', {
    unsafe: true,
  });
const spec = builder.build();
display(scroller(Object.assign(document.createElement("div"), { innerHTML: await renderHTMLAsync(spec, byWins) })));
```

## Sort, filter, page and select

`createTable(spec, rows)` is a headless engine: it holds the sort, the filters, the page and the selection. `renderHTML(table)` writes its current state as HTML (the same string a server or a static site would send), and `hydrate(element, table)` wires that HTML to it without React. Then:

- click a column header to sort it (again to reverse it, a third time to clear it);
- type in the search box to filter every column, or in the **division** box to filter that column;
- page with the pager (**Rows per page** sets its size);
- click a row, or press Space on it, to select it; hovering a row underlines it.

The line under the table is read from the engine on every change, so it shows what the HTML is drawing.

```js
const pageSize = view(select([4, 8], { label: "Rows per page", value: 4 }));
```

```js
const interactiveSpec = defineTable()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true }),
    c.text("division", { filterable: true }),
    c.text("qb", { label: "QB" }),
    c.int("wins"),
    c.int("losses"),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
    c.num("net_epa", { label: "Net EPA/play", digits: 3, forceSign: true }),
  ])
  .theme(theme, theme === "sdvTeam" ? { density, options: { league: "nfl", team } } : { density })
  .title("AFC, 2024")
  .subtitle("Sort, search, filter, page and select")
  .rowKey("team")
  .build();
await prepare(interactiveSpec);
const table = createTable(interactiveSpec, standings, { pageSize: Number(pageSize), sort: { col: "wins", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt"), table);
display(scroller(host));
// a readout of the engine's state, rewritten on every change
const readout = document.createElement("p");
const describe = () => {
  const s = table.state;
  const sort = s.sort ? `sorted by ${s.sort.col} (${s.sort.dir})` : "unsorted";
  const filters = [s.globalFilter && `search "${s.globalFilter}"`, ...Object.entries(s.filters).map(([k, v]) => `${k} "${v}"`)].filter(Boolean);
  const selected = [...table.getSelection()];
  readout.textContent = `${table.filteredCount} of ${standings.length} rows, ${sort}${filters.length ? `, ${filters.join(", ")}` : ""}; page ${s.page + 1} of ${table.pageCount}; selected: ${selected.length ? selected.join(", ") : "none"}${table.getHover() ? `; hovering ${table.getHover()}` : ""}.`;
};
describe();
invalidation.then(table.subscribe(describe));
display(readout);
```
