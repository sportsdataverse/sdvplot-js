---
title: Team colours
---

# Team colours

A league's palette, the contrast of any pair, `matchupColors` choosing a pair that reads on a light and a dark page, and team colours as an Observable Plot scale. The colours come from the bundled team index; the charts draw the 2024 NFL, 2023-24 NBA and 2025-26 NHL seasons.

```js
import * as Plot from "@observablehq/plot";
import { LEAGUES, contrast, loadLeague, matchupColors, onColor, palette } from "./_sdv/sdvplot.js";
import { logos, teamFill } from "./_sdv/sdvplot-plot.js";
import { select } from "./components/controls.js";
```

## A league's palette

Every team's primary or secondary colour in one league, keyed by abbreviation (by `team_id` where two teams share one). Each label is drawn in the ink `onColor` picks for its swatch: black or white, whichever has the higher contrast.

```js
const league = view(select(LEAGUES, { label: "League", value: "nfl" }));
const which = view(select(["primary", "secondary"], { label: "Colour", value: "primary" }));
```

```js
const colors = Object.entries(await palette(league, undefined, { which })).map(([team, color]) => ({ team, color }));
```

```js
const cols = Math.max(4, Math.min(8, Math.floor(width / 84)));
const at = { x: (_, i) => i % cols, y: (_, i) => Math.floor(i / cols) };
display(
  Plot.plot({
    width,
    height: 20 + 40 * Math.ceil(colors.length / cols),
    axis: null,
    x: { domain: Array.from({ length: cols }, (_, i) => i) },
    marks: [
      // a thin outline keeps a navy or black swatch visible on a dark page
      Plot.cell(colors, { ...at, fill: "color", inset: 1, stroke: dark ? "#8a8a8a" : null, title: (d) => `${d.team} ${d.color}` }),
      Plot.text(colors, { ...at, text: "team", fill: (d) => onColor(d.color), fontWeight: 600 }),
    ],
  }),
);
```

${colors.length} ${league} teams have a ${which} colour.

## Two teams that clash

Two teams' primary colours can be hard to tell apart: the Lakers' purple and the Kings' purple are a classic case. `matchupColors(teamA, teamB, { league })` returns one pair for a light page and one for a dark page. Each colour reads on its background (contrast at least 2.5:1) and the two stay apart (a CIEDE2000 distance of at least 20); when a primary fails, it tries the secondary, then moves the lightness. The numbers under each swatch are its contrast against that background.

```js
const pairLeague = view(select(["nba", "nfl", "nhl", "mlb", "wnba", "cfb", "mbb"], { label: "League", value: "nba" }));
```

```js
const pairColors = Object.entries(await palette(pairLeague)).map(([team, color]) => ({ team, color }));
const names = pairColors.map((d) => d.team).sort();
const a = view(select(names, { label: "Team", value: names.includes("LAL") ? "LAL" : names[0] }));
const b = view(select(names, { label: "against", value: names.includes("SAC") ? "SAC" : names[1] }));
```

```js
const pair = await matchupColors(a, b, { league: pairLeague });
const primaries = [a, b].map((t) => pairColors.find((d) => d.team === t).color);
const BG = { light: "#ffffff", dark: "#181a1b" }; // matchupColors' default backgrounds
const swatches = [
  ...[a, b].map((team, i) => ({ row: "Primaries", team, color: primaries[i], bg: "#ffffff" })),
  ...[a, b].map((team, i) => ({ row: "Light page", team, color: pair.light[i], bg: BG.light })),
  ...[a, b].map((team, i) => ({ row: "Dark page", team, color: pair.dark[i], bg: BG.dark })),
];
const rowsOrder = ["Primaries", "Light page", "Dark page"];
display(
  Plot.plot({
    width: Math.min(width, 560),
    height: 230,
    marginLeft: 84,
    x: { axis: null, domain: [a, b], padding: 0.08 },
    y: { domain: rowsOrder, label: null, padding: 0.12 },
    marks: [
      // each row's background, then the two colours on it
      Plot.cell(swatches, { x: "team", y: "row", fill: "bg", stroke: "#888", strokeOpacity: 0.3 }),
      Plot.cell(swatches, { x: "team", y: "row", fill: "color", inset: 8 }),
      Plot.text(swatches, {
        x: "team",
        y: "row",
        text: (d) => `${d.team} ${d.color}\n${contrast(d.color, d.bg).toFixed(2)}:1`,
        fill: (d) => onColor(d.color),
        lineHeight: 1.2,
      }),
    ],
  }),
);
```

The raw primaries ${primaries[0]} and ${primaries[1]} have a contrast of ${contrast(primaries[0], primaries[1]).toFixed(2)}:1 with each other (1 is the same colour). On a light page `matchupColors` draws ${a} in ${pair.light[0]} and ${b} in ${pair.light[1]}; on a dark page, ${pair.dark[0]} and ${pair.dark[1]}.

## A team-coloured chart on a light or a dark page

Every 2024 regular-season game of the Chiefs and the Eagles, as each team's running point differential by week. The two lines take `matchupColors("KC", "PHI")`: **Theme** follows this page's light or dark mode, or forces either one, and the chart takes the pair made for that background. Each line ends in its team's logo.

```js
const games = await FileAttachment("data/kc_phi_games_2024.json").json();
await loadLeague("nfl");
const kcPhi = await matchupColors("KC", "PHI", { league: "nfl" });
// each team's margin in each of its games, then the running sum by week
const running = ["KC", "PHI"].flatMap((team) => {
  let total = 0;
  return games
    .filter((g) => g.home_team === team || g.away_team === team)
    .sort((x, y) => x.week - y.week)
    .map((g) => {
      const margin = g.home_team === team ? g.home_score - g.away_score : g.away_score - g.home_score;
      total += margin;
      return { team, week: g.week, margin, total };
    });
});
```

```js
const theme = view(select(["follow the page", "light", "dark"], { label: "Theme", value: "follow the page" }));
```

```js
const mode = theme === "follow the page" ? (dark ? "dark" : "light") : theme;
const [kc, phi] = kcPhi[mode];
const ends = ["KC", "PHI"].map((team) => running.filter((r) => r.team === team).at(-1));
display(
  Plot.plot({
    width,
    height: 340,
    marginRight: 50,
    style: {
      background: mode === "dark" ? "#181a1b" : "#ffffff",
      color: mode === "dark" ? "#e8e6e3" : "#1b1e23",
      borderRadius: "6px",
    },
    grid: true,
    x: { label: "Week →", domain: [1, 18], ticks: 9 },
    y: { label: "↑ Running point differential" },
    color: { domain: ["KC", "PHI"], range: [kc, phi] },
    marks: [
      Plot.ruleY([0]),
      Plot.line(running, { x: "week", y: "total", stroke: "team", strokeWidth: 3 }),
      Plot.dot(running, {
        x: "week",
        y: "total",
        fill: "team",
        r: 3,
        tip: true,
        title: (d) => `${d.team}, week ${d.week}: ${d.margin > 0 ? "won by" : "lost by"} ${Math.abs(d.margin)}\nRunning total ${d.total > 0 ? "+" : ""}${d.total}`,
      }),
      logos(ends, { league: "nfl", x: "week", y: "total", team: "team", height: 0.1, dx: 24 }),
    ],
  }),
);
```

On the ${mode} background, Kansas City is ${kc} and Philadelphia ${phi}: contrast ${contrast(kc, mode === "dark" ? "#181a1b" : "#ffffff").toFixed(2)}:1 and ${contrast(phi, mode === "dark" ? "#181a1b" : "#ffffff").toFixed(2)}:1 against it.

## Team colours as a Plot scale

`teamFill(league, { values })` is an ordinal Plot colour scale whose range is each team's colour, so `fill: "team"` paints every bar in its own team's colour, and its legend names the teams. Logos sit at the bar ends. **Standings** switches between three real tables.

```js
const STANDINGS = {
  "NFL: 2024 AFC West and East (wins)": { league: "nfl", file: "standings", value: "wins", team: "team" },
  "NBA: 2023-24 Pacific Division (wins)": { league: "nba", file: "nba_standings", value: "wins", team: "team" },
  "NHL: 2025-26 Atlantic Division (points)": { league: "nhl", file: "nhl_standings", value: "points", team: "team" },
};
const table = view(select(Object.keys(STANDINGS), { label: "Standings", value: Object.keys(STANDINGS)[0] }));
```

```js
const FILES = {
  standings: FileAttachment("data/standings.json"),
  nba_standings: FileAttachment("data/nba_standings.json"),
  nhl_standings: FileAttachment("data/nhl_standings.json"),
};
const chosen = STANDINGS[table];
const standing = await FILES[chosen.file].json();
await loadLeague(chosen.league);
```

```js
display(
  Plot.plot({
    width,
    height: 50 + 36 * standing.length,
    marginLeft: 90,
    marginRight: 40,
    x: { label: `${chosen.value[0].toUpperCase()}${chosen.value.slice(1)} →`, grid: true },
    y: { label: null },
    color: teamFill(chosen.league, { values: standing.map((d) => d.team), legend: true }),
    marks: [
      Plot.barX(standing, {
        x: chosen.value,
        y: "team",
        fill: "team",
        stroke: dark ? "#8a8a8a" : null, // visible navy and black bars on a dark page
        strokeWidth: 0.6,
        sort: { y: "-x" },
      }),
      logos(standing, { league: chosen.league, x: chosen.value, y: "team", team: "team", height: 0.85 / standing.length, dx: 20 }),
      Plot.ruleX([0]),
    ],
  }),
);
```
