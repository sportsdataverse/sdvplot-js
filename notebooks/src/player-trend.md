---
title: Player trend explorer
---

# Player trend explorer

**The question:** is a player trending up or down, and what did they do over a stretch you pick? Season averages hide form. A game-by-game line with a rolling average shows the streaks, and brushing a stretch of dates gives that window's averages, the numbers a fantasy manager or a beat writer wants.

**The workflow:** [sportsdataverse-js](https://js.sportsdataverse.org) reads ESPN's game log (`sdv.nba.espnNbaPlayerGamelog({ athlete_id, season, parsed: true })` in Node; the same parser on the same JSON here). The parser gives one row per game: the season block (`season_type_name`), the event id and fourteen stats as `stat_0` to `stat_13`. The rest is in the same response beside the rows: `names` says which stat is which (`stat_13` is `points`), and `events` holds each game's date, opponent and result. The page joins the two on the event id, draws the chosen stat with sdvplot (the player's team colour and ESPN headshot), and links a 1-D `brushFilter` on the dates to an sdvtables table of the games.

The snapshot is LeBron James's 2023-24 game log (ESPN athlete 1966, `season=2024`): one capture shared with sdv-js's [player form tutorial](https://js.sportsdataverse.org/docs/tutorials/sdvplot-player-form), byte for byte. Tick **Fetch live from ESPN** to load any NBA or WNBA player by ESPN athlete id (the number in an espn.com player URL); leave **Season** blank for ESPN's current one.

```js
import * as Plot from "@observablehq/plot";
import { createSelection, headshotUrl, loadLeague, teamColorsSync } from "./_sdv/sdvplot.js";
import { brushFilter, linkSelection } from "./_sdv/interact.js";
import { createTable, defineTable } from "./_sdv/sdvtables.js";
import { hydrate, prepare, renderHTML } from "./_sdv/sdvtables-html.js";
import { parseEndpoint } from "./_sdv/sdv-parsers.js";
import { checkbox, note, scroller, select, text } from "./components/controls.js";
import { espnJSON, params, source } from "./components/espn.js";
import { BLOCKS, exhibitions, gameLog } from "./components/workflows.js";
```

```js
const prov = await FileAttachment("data/sdvjs_provenance.json").json();
const snap = prov.snapshots.find((s) => s.name === "athlete_gamelog_nba_1966_2024");
```

```js
const live = view(checkbox("Fetch live from ESPN", { value: params.has("live") }));
const league = view(select(["nba", "wnba"], { label: "League (live)", value: params.get("league") === "wnba" ? "wnba" : "nba" }));
const athlete = view(text("Athlete id (live)", { value: params.get("athlete") ?? "1966", size: 9 }));
const season = view(text("Season (live; blank = current)", { value: params.get("season") ?? "", placeholder: "e.g. 2025", size: 8 }));
```

```js
const got = await espnJSON(
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/${league}/athletes/${encodeURIComponent(athlete)}/gamelog${season ? `?season=${encodeURIComponent(season)}` : ""}`,
  { live, snapshot: FileAttachment("data/sdvjs_athlete_gamelog_nba_1966_2024.json") },
);
const lg = got.live ? league : "nba";
const who = got.live ? athlete : "1966";
const raw = got.raw;
// one row per game: the parser's stats, joined to the event beside them on the event id
const games = gameLog(raw, parseEndpoint("espn", "athlete_gamelog", raw));
await loadLeague(lg);
display(source(got, snap));
```

```js
const block = view(select(Object.keys(BLOCKS), { label: "Games", value: "Regular season" }));
const stat = view(select(["points", "rebounds", "assists", "minutes"], { label: "Stat", value: "points" }));
```

```js
const rows = games.filter(BLOCKS[block]);
const left = exhibitions(games);
// a 10-game rolling mean (shorter at the start of the window)
const WINDOW = 10;
for (const [i, g] of rows.entries()) {
  const w = rows.slice(Math.max(0, i - WINDOW + 1), i + 1);
  g.rolling = w.reduce((a, d) => a + d[stat], 0) / w.length;
}
const color = teamColorsSync(lg, rows.at(-1)?.team ?? "") ?? "#4a4a4a";
const head = document.createElement("div");
head.style.cssText = `display: flex; align-items: center; gap: 12px; border-left: 6px solid ${color}; padding-left: 10px; margin: 0.5em 0`;
head.append(
  Object.assign(document.createElement("img"), { src: headshotUrl(who, lg), alt: `ESPN athlete ${who}`, width: 96, height: 70 }),
  Object.assign(document.createElement("div"), {
    textContent: `ESPN athlete ${who}, ${rows[0]?.block.split(" ")[0] ?? ""}: ${rows.length} games, ${(rows.reduce((a, g) => a + g[stat], 0) / (rows.length || 1)).toFixed(1)} ${stat} a game`,
  }),
);
display(head);
```

${left.length ? `Left out of the regular season: ${left.map((g) => `${g.day} ${g.opp} (${g.note})`).join("; ")}.` : ""} ${got.live || block !== "Regular season" ? "" : `That leaves ${rows.length} games and ${rows.reduce((a, g) => a + g.points, 0).toLocaleString("en-US")} points, LeBron James's official 2023-24 line.`}

**Drag across the chart** to brush a stretch of games: the table keeps those games and the line under the table gives their averages. Click outside the brush to clear it.

```js
const store = createSelection();
const chart = Plot.plot({
  width,
  height: Math.min(360, Math.max(240, width * 0.4)),
  marginLeft: 44,
  x: { type: "utc", label: null },
  y: { label: `↑ ${stat}`, grid: true, zero: true },
  marks: [
    Plot.dot(rows, { x: "date", y: stat, r: 3.5, fill: color, fillOpacity: 0.45, stroke: color }),
    Plot.line(rows, { x: "date", y: "rolling", stroke: color, strokeWidth: 2.5 }),
    Plot.tip(rows, Plot.pointerX({ x: "date", y: stat, title: (g) => `${g.day} ${g.opp} ${g.result}\n${g[stat]} ${stat} (10-game mean ${g.rolling.toFixed(1)})` })),
  ],
});
const brush = brushFilter(chart, store, { data: rows, x: "date", id: "event_id", empty: "clear" });

const spec = defineTable()
  .columns((c) => [
    c.text("day", { label: "Date" }),
    c.text("opp", { label: "Opp" }),
    c.text("result", { label: "Result" }),
    c.int("minutes", { label: "MIN" }),
    c.int("points", { label: "PTS" }),
    c.int("rebounds", { label: "REB" }),
    c.int("assists", { label: "AST" }),
  ])
  .title("Game log")
  .rowKey("event_id")
  .build();
await prepare(spec);
const table = createTable(spec, rows, { pageSize: 10, sort: { col: "day", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt"), table);
const offTable = linkSelection(store, { table });
invalidation.then(() => {
  offTable();
  brush.destroy();
});
display(rows.length ? chart : note("No games in this block."));
display(scroller(host));
```

```js
const brushed = Generators.observe((notify) => {
  const pick = (s) => (s.predicate ? rows.filter(s.predicate) : rows);
  notify(pick(store.getState()));
  return store.subscribe((s) => notify(pick(s)));
});
```

```js
const avg = (k) => (brushed.reduce((a, g) => a + g[k], 0) / (brushed.length || 1)).toFixed(1);
```

${brushed.length === rows.length ? `All ${rows.length} games` : `The ${brushed.length} brushed games (${brushed[0]?.day ?? ""} to ${brushed.at(-1)?.day ?? ""})`}: ${avg("points")} points, ${avg("rebounds")} rebounds and ${avg("assists")} assists in ${avg("minutes")} minutes a game.

## What to take from it

- **The rows are half the answer.** sdv-js's game-log parser returns the stats as positional columns, because ESPN does: `names` beside them says what each position means, and `events` holds the dates and opponents. Look a column up by name (`stat_${names.indexOf("points")}`), never by a hard-coded position.
- **"Regular Season" is ESPN's filing, not the league's.** ESPN puts the All-Star Game and the in-season cup finals under "Regular Season". Dropping them turns the snapshot's 73 logged games into the 71 that count, 1,822 points (25.7 a game), LeBron James's official 2023-24 line.
- **Brush, then summarise.** A 1-D `brushFilter` on the dates writes a row test to the store; the table applies it as it is, and the summary line reads the same test, so the window's averages always match the rows on screen.

**Script it in Node:** sdv-js's [player form tutorial](https://js.sportsdataverse.org/docs/tutorials/sdvplot-player-form) draws the same season as a static chart with `meanLines` and `headshots`. The [Linked interactivity](./linked.html) notebook covers `brushFilter` in depth.
