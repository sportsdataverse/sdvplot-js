---
title: Build your own game dashboard
---

# Build your own game dashboard

**The question:** who shot from where, and how did it show up in the box score? A single-game dashboard puts the shot chart and the box score side by side and links them, so pointing at a player in one finds him in the other.

**The workflow:** one ESPN `summary` request, three sections from [sportsdataverse-js](https://js.sportsdataverse.org) (`sdv.nba.espnNbaSummary({ event_id, parsed: true, section })` in Node; the same parser on the same JSON here): `header` for the teams, `plays` for every play with its court coordinates, and `boxscore_player` for the box score. The page keeps the field-goal attempts, moves them onto a sporty half court, joins each shot to its shooter's box-score row on the ESPN athlete id, and links the court and an sdvtables table through one sdvplot selection store.

The snapshot is Toronto at Orlando on 17 March 2024 (Orlando won 111-96; ESPN event 401585607), the same game sdv-js's shot-chart tutorials draw. Tick **Fetch live from ESPN** to load any NBA or WNBA game by its ESPN event id, or open one from the [live scoreboard](./scoreboard.html).

```js
import * as Plot from "@observablehq/plot";
import { createSelection, loadLeague, matchupColorsSync } from "./_sdv/sdvplot.js";
import { brushFilter, linkSelection } from "./_sdv/interact.js";
import { linkIds, surface } from "./_sdv/sdvplot-plot.js";
import { toSurfaceFrame } from "./_sdv/sporty.js";
import { createTable, defineTable } from "./_sdv/sdvtables.js";
import { hydrate, prepare, renderHTML } from "./_sdv/sdvtables-html.js";
import { parseEndpoint } from "./_sdv/sdv-parsers.js";
import { checkbox, note, scroller, select, text } from "./components/controls.js";
import { SITE, espnJSON, params, source } from "./components/espn.js";
import { ESPN_BASKETBALL, boxScore, checkJoinKey, fieldGoals } from "./components/workflows.js";
```

```js
const prov = await FileAttachment("data/sdvjs_provenance.json").json();
const snap = prov.snapshots.find((s) => s.name === "summary_nba_401585607");
const LEAGUES = { NBA: ["basketball/nba", "nba"], WNBA: ["basketball/wnba", "wnba"] };
```

```js
const live = view(checkbox("Fetch live from ESPN", { value: params.has("live") }));
const league = view(select(Object.keys(LEAGUES), { label: "League (live)", value: params.get("league") === "wnba" ? "WNBA" : "NBA" }));
const eventId = view(text("Event id (live)", { value: params.get("event") ?? "401585607" }));
```

```js
const [path, sdvLeague] = LEAGUES[league];
const got = await espnJSON(`${SITE}/${path}/summary?event=${encodeURIComponent(eventId)}`, {
  live,
  snapshot: FileAttachment("data/sdvjs_summary_nba_401585607.json"),
});
const lg = got.live ? sdvLeague : "nba";
const section = (name) => parseEndpoint("espn", "summary", got.raw, name);
const comp = JSON.parse(section("header")[0].competitions)[0];
const teams = ["away", "home"].map((s) => comp.competitors.find((c) => c.homeAway === s).team);
const plays = section("plays");
const box = section("boxscore_player");
const shots = toSurfaceFrame(fieldGoals(plays), { from: ESPN_BASKETBALL, x: "coordinate_x", y: "coordinate_y" });
// The join key: the shot's shooter and the box score's player are both ESPN athlete ids, but ESPN sends ids as strings
// in some payloads and numbers in others, and a string never equals a number. Check one type on both sides first.
checkJoinKey(shots, "shooter_id", box, "athlete_id");
const players = boxScore(box, shots);
await loadLeague(lg);
const colors = matchupColorsSync(teams[0].id, teams[1].id, { league: lg })[dark ? "dark" : "light"];
const colorOf = new Map(teams.map((t, i) => [t.id, colors[i]]));
display(source(got, snap));
```

${teams[0].displayName} at ${teams[1].displayName}: ${shots.length} field-goal attempts with a location, ${players.length} players who played. ${players.every((p) => p.charted === p.fga) ? `Every player's charted attempts equal the box score's field-goal attempts (${players.reduce((a, p) => a + p.fga, 0)} in all), so the join lost nothing.` : `For ${players.filter((p) => p.charted !== p.fga).length} players the charted attempts differ from the box score's (ESPN logs a location for most attempts, not always all).`}

Hover a player's row to light that player's shots, or a shot to underline its shooter. Click rows to select players. **Drag a box on the court** to select everyone who shot from that zone (clear it with a click outside the box). **Team** narrows both views to one side.

```js
const team = view(select(["Both", ...teams.map((t) => t.abbreviation)], { label: "Team", value: "Both" }));
```

```js
const teamId = teams.find((t) => t.abbreviation === team)?.id;
const shown = teamId ? shots.filter((s) => s.team_id === teamId) : shots;
const listed = teamId ? players.filter((p) => p.team === teamId) : players;
const store = createSelection();
const half = surface(lg, { displayRange: "offense" });
const court = Plot.plot({
  ...half.scales,
  width: Math.min(width, 560),
  marks: [
    ...half.marks,
    Plot.dot(shown, {
      x: "surface_x",
      y: "surface_y",
      r: 4,
      fill: (s) => (s.scoring_play ? colorOf.get(s.team_id) : "none"),
      stroke: (s) => colorOf.get(s.team_id),
      strokeWidth: 1.5,
      title: (s) => `${s.clock_display_value} ${s.period_display_value}: ${s.text}`,
      // each shot's link id is its shooter's athlete id, the table's rowKey
      render: linkIds(shown, "shooter_id"),
    }),
  ],
});
// the zone brush writes its own store; its shooters become the main store's selection
const zones = createSelection();
const brush = brushFilter(court, zones, { data: shown, x: "surface_x", y: "surface_y", id: "id", empty: "clear" });
const offZones = zones.subscribe((s) =>
  store.set({ selected: s.predicate ? [...new Set(shown.filter(s.predicate).map((d) => d.shooter_id))] : [] }),
);
const offCourt = linkSelection(store, { figure: court });

const spec = defineTable()
  .columns((c) => [
    c.headshot("id", { league: lg, label: "" }),
    c.text("name", { label: "Player" }),
    c.logo("team", { league: lg, label: "Team" }),
    c.int("min", { label: "MIN" }),
    c.int("pts", { label: "PTS" }),
    c.text("fg", { label: "FG" }),
    c.text("three", { label: "3PT" }),
    c.int("reb", { label: "REB" }),
    c.int("ast", { label: "AST" }),
    c.num("pm", { label: "+/-", digits: 0, forceSign: true }),
    c.int("charted", { label: "Charted" }),
  ])
  .title("Box score")
  .subtitle("Charted: field-goal attempts on the court above")
  .rowKey("id")
  .build();
await prepare(spec);
const table = createTable(spec, listed, { pageSize: 13, sort: { col: "pts", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt"), table);
const offTable = linkSelection(store, { table });
invalidation.then(() => {
  for (const off of [offZones, offCourt, offTable]) off();
  brush.destroy();
});
const legend = document.createElement("p");
legend.style.cssText = "font-size: 0.85em; margin: 0.25em 0";
for (const t of teams) {
  const swatch = document.createElement("span");
  swatch.style.cssText = `display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; background: ${colorOf.get(t.id)}; margin: 0 0.3em 0 0.8em; vertical-align: -0.05em`;
  legend.append(swatch, t.abbreviation);
}
legend.append(" · filled = made, hollow = missed");
display(shots.length ? court : note("ESPN has no shot locations for this game yet."));
display(legend);
display(scroller(host));
```

## What to take from it

- **Check the join key before the join.** The shot's shooter comes from the play's `participants`, the box score's player from `athlete_id`. Both are ESPN athlete ids, but ESPN sends ids as strings in some payloads and as numbers in others, and `"4432573" === 4432573` is false: a mismatch does not fail, it joins nothing. The page checks that both sides hold one and the same type before it joins (here, strings), and throws if not.
- **Validate against the source's own totals.** Counting each player's charted attempts and comparing them with the box score's FGA is a free end-to-end check of the filter (no free throws, no missing locations) and the join.
- **One store, any number of views.** The court and the table never call each other: each is linked to the same selection store with `linkSelection`, and the zone brush writes its own store, which the page turns into a selection of shooters.

**Script it in Node:** sdv-js's [shot chart tutorial](https://js.sportsdataverse.org/docs/tutorials/sdvplot-shot-chart) draws this game's shots to an SVG, and its [shots-against-the-league tutorial](https://js.sportsdataverse.org/docs/tutorials/sdvplot-shots-vs-league) compares them with the whole 2023-24 season. The [Shot charts](./shots.html) notebook covers hexagons, zones and league baselines.
