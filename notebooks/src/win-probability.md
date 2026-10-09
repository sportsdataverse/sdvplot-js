---
title: Win-probability scrubber
---

# Win-probability scrubber

**The question:** which plays decided the game? ESPN publishes a win probability after every play of an NFL or college football game. Drawn over the game and paired with the play-by-play, it shows when the game turned, and the biggest jumps name the plays that turned it.

**The workflow:** one ESPN `summary` request holds everything. [sportsdataverse-js](https://js.sportsdataverse.org) splits it into sections (`sdv.nfl.espnNflSummary({ event_id, parsed: true, section })` in Node; here the same parser, `parseEndpoint("espn", "summary", raw, section)`, on the same JSON in your browser): `header` for the teams and the final score, `winprobability` for one row per play (the home team's chance and the play's id), and `drive_plays` for the plays themselves. The page joins the two on the play id, colours the home and away halves with sdvplot's `matchupColors`, puts each team's logo on its side of 50%, and hovers the nearest play with `nearestHover`.

The snapshot is the 2024 NFL season opener, Baltimore at Kansas City on 5 September 2024 (Kansas City won 27-20; ESPN event 401671789). Tick **Fetch live from ESPN** to load any NFL or college football game by its ESPN event id (the number in an espn.com game URL), or arrive here from a card on the [live scoreboard](./scoreboard.html).

```js
import * as Plot from "@observablehq/plot";
import { createSelection, loadLeague, matchupColorsSync, toId } from "./_sdv/sdvplot.js";
import { nearestHover } from "./_sdv/interact.js";
import { logos } from "./_sdv/sdvplot-plot.js";
import { createTable, defineTable } from "./_sdv/sdvtables.js";
import { hydrate, prepare, renderHTML } from "./_sdv/sdvtables-html.js";
import { parseEndpoint } from "./_sdv/sdv-parsers.js";
import { checkbox, range, scroller, select, text } from "./components/controls.js";
import { SITE, espnJSON, params, source } from "./components/espn.js";
import { winProbability } from "./components/workflows.js";
```

```js
const prov = await FileAttachment("data/sdvjs_provenance.json").json();
const snap = prov.snapshots.find((s) => s.name === "summary_nfl_401671789");
const LEAGUES = { NFL: ["football/nfl", "nfl"], "College football": ["football/college-football", "cfb"] };
```

```js
const live = view(checkbox("Fetch live from ESPN", { value: params.has("live") }));
const league = view(select(Object.keys(LEAGUES), { label: "League (live)", value: params.get("league") === "cfb" ? "College football" : "NFL" }));
const eventId = view(text("Event id (live)", { value: params.get("event") ?? "401671789" }));
```

```js
const [path, sdvLeague] = LEAGUES[league];
const got = await espnJSON(`${SITE}/${path}/summary?event=${encodeURIComponent(eventId)}`, {
  live,
  snapshot: FileAttachment("data/sdvjs_summary_nfl_401671789.json"),
});
const lg = got.live ? sdvLeague : "nfl";
const section = (name) => parseEndpoint("espn", "summary", got.raw, name);
// the drive in progress, parsed as sdv-js parses the finished ones (live games only)
const current = got.raw.drives?.current
  ? parseEndpoint("espn", "summary", { drives: { previous: [got.raw.drives.current] } }, "drive_plays")
  : [];
const { comp, home, away, rows: wp } = winProbability(section, current);
await loadLeague(lg);
const [awayColor, homeColor] = matchupColorsSync(away.team.id, home.team.id, { league: lg })[dark ? "dark" : "light"];
display(source(got, snap));
```

${wp.length ? `${away.team.displayName} at ${home.team.displayName}, ${new Date(comp.date).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/New_York" })}: ${comp.status?.type?.detail ?? ""}, ${away.team.abbreviation} ${away.score}, ${home.team.abbreviation} ${home.score}. ${wp.length} win-probability rows.` : "ESPN has no win probability for this game yet (a game that has not started, or one ESPN does not model)."}

Drag **Play** to scrub through the game: the rule and the panel under the chart follow it. Hover the chart for the nearest play.

```js
const play = view(range([0, Math.max(0, wp.length - 1)], { label: "Play", value: Math.max(0, wp.length - 1) }));
```

```js
const store = createSelection();
const PERIODS = [...new Set(wp.map((d) => d.period))];
const chart = Plot.plot({
  width,
  height: Math.min(420, Math.max(280, width * 0.45)),
  marginRight: 56,
  x: {
    label: null,
    domain: [0, Math.max(1, wp.length - 1)],
    // a tick at each quarter's first play, named for the quarter
    ticks: PERIODS.map((q) => wp.find((d) => d.period === q).i),
    tickFormat: (i) => {
      const q = wp[i]?.period;
      return q > 4 ? "OT" : `Q${q}`;
    },
  },
  y: { domain: [0, 1], tickFormat: "%", label: `↑ ${home.team.abbreviation} win probability`, grid: true },
  marks: [
    // the home side of 50% in the home colour, the away side in the away colour
    Plot.areaY(wp, { x: "i", y1: 0.5, y2: (d) => Math.max(d.wp, 0.5), fill: homeColor, fillOpacity: 0.35, curve: "step-after" }),
    Plot.areaY(wp, { x: "i", y1: 0.5, y2: (d) => Math.min(d.wp, 0.5), fill: awayColor, fillOpacity: 0.35, curve: "step-after" }),
    Plot.lineY(wp, { x: "i", y: "wp", curve: "step-after", strokeWidth: 1.5 }),
    Plot.ruleY([0.5], { strokeDasharray: "4,3", strokeOpacity: 0.6 }),
    Plot.ruleX([play], { stroke: "currentColor", strokeOpacity: 0.7 }),
    Plot.dot(wp.slice(play, play + 1), { x: "i", y: "wp", r: 5, fill: "currentColor" }),
    // each team's logo on its side of 50%, past the last play
    logos(
      [
        { team: home.team.id, y: 0.85 },
        { team: away.team.id, y: 0.15 },
      ],
      { league: lg, x: wp.length - 1, y: "y", team: "team", height: 0.14, dx: 30, variant: dark ? "dark" : "default" },
    ),
  ],
});
const sx = chart.scale("x");
const sy = chart.scale("y");
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const hover = nearestHover(chart, store, {
  points: wp.map((d) => ({ x: sx.apply(d.i), y: sy.apply(d.wp), id: toId(d.i) })),
  dimension: "x",
  label: (id) => {
    const d = wp[Number(id)];
    return { lines: [`${d.when}${d.score ? ` · ${d.score}` : ""}`, d.play.length > 70 ? `${d.play.slice(0, 69)}…` : d.play, `${home.team.abbreviation} ${pct(d.wp)} (${d.swing >= 0 ? "+" : ""}${(100 * d.swing).toFixed(1)})`] };
  },
});
invalidation.then(() => hover.destroy());
display(wp.length ? chart : document.createTextNode(""));
```

```js
const at = wp[play];
const panel = document.createElement("div");
panel.style.cssText = "border-left: 4px solid var(--theme-foreground-focus); padding: 4px 12px; margin: 0.5em 0 1em";
if (at)
  panel.append(
    Object.assign(document.createElement("strong"), { textContent: `${at.when}${at.score ? ` · ${at.score}` : ""}` }),
    document.createElement("br"),
    at.play,
    document.createElement("br"),
    `${home.team.abbreviation} win probability ${pct(at.wp)}, ${at.swing >= 0 ? "up" : "down"} ${Math.abs(100 * at.swing).toFixed(1)} points on this play.`,
  );
display(panel);
```

## The plays that decided it

The eight plays that moved the win probability most, either way. A swing is in percentage points of the home team's chance.

```js
const swings = wp
  // plays only: not the pregame line, and not ESPN's "End of Game" row, where the model settles to 0 or 100%
  .filter((d) => d.i > 0 && !/^End /.test(d.type))
  .map((d) => ({ ...d, swing_pts: 100 * d.swing, after: 100 * d.wp }))
  .sort((a, b) => Math.abs(b.swing_pts) - Math.abs(a.swing_pts))
  .slice(0, 8);
const spec = defineTable()
  .columns((c) => [
    c.text("when", { label: "When" }),
    c.text("score", { label: "Score" }),
    c.text("play", { label: "Play" }),
    c.num("swing_pts", { label: "Swing", digits: 1, forceSign: true }),
    c.num("after", { label: `${home.team.abbreviation} win %`, digits: 1 }),
  ])
  .title("Biggest win-probability swings")
  .subtitle(`${away.team.displayName} at ${home.team.displayName}`)
  .build();
await prepare(spec);
const table = createTable(spec, swings);
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt"), table);
display(scroller(host));
```

## What to take from it

- **One request, many tables.** A `summary` response holds the header, the plays and the win probability; sdv-js's `section` argument picks one, and the sections share ids (`play_id` in one is `id` in the other), so they join without guessing.
- **Read the whole curve, not the last point.** In the snapshot, Kansas City was above 50% after 95% of the plays; Baltimore led only in the first quarter (Kansas City's low was 38%). The two biggest swings were both Lamar Jackson deep passes: the 49-yard touchdown to Isaiah Likely early in the fourth quarter (−20.7 points) and the 38-yard completion to Rashod Bateman with 43 seconds left (−21.4) that reached the Kansas City 10.
- **Read the score columns, not the text.** The last snap's text begins "pass short middle to I.Likely for 10 yards, TOUCHDOWN"; only later in the same sentence does the review reverse it. The play's `home_score` and `away_score` (27 and 20) and the win probability (still 87% for Kansas City, then 100% at the end) carry the ruling that stood.
- **Colour the halves.** Shading each side of 50% in its team's colour, from a pair `matchupColors` chose to stay apart, makes "who was ahead" readable at a glance, in light and dark mode.

**Script it in Node:** the same three sections come from `sdv.nfl.espnNflSummary({ event_id: 401671789, parsed: true, section: "winprobability" })`; see sdv-js's [cross-league tutorial](https://js.sportsdataverse.org/docs/tutorials/cross-league) for the `summary` sections. The [Linked interactivity](./linked.html) notebook covers `nearestHover` and `tooltip` in depth.
