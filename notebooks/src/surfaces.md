---
title: Playing surfaces
---

# Playing surfaces

Every court, field, rink, pitch and sheet sporty draws, as Observable Plot marks; a league's surface in a team's colours; and real events moved onto each surface with `toSurfaceFrame`.

```js
import * as Plot from "@observablehq/plot";
import { loadLeague, teams } from "./_sdv/sdvplot.js";
import { SURFACES, logos, surface as teamSurface, teamColor } from "./_sdv/sdvplot-plot.js";
import { SPORTS, displayRanges, features, leagues, surface, toSurfaceFrame } from "./_sdv/sporty.js";
import { surfaceMark, surfaceScales } from "./_sdv/sporty-plot.js";
import { checkbox, select } from "./components/controls.js";
```

## Every sport

Pick a sport, then one of its rule sets (each league's dimensions are its own: an NBA three-point line is not a FIBA one). **Show** picks how much of the surface to draw (a half court, one zone, the whole thing), and **Rotation** turns it. A rotated surface is drawn upright, so a vertical court is narrower than a horizontal one.

```js
const sport = view(select(SPORTS, { label: "Sport", value: "basketball" }));
const rotation = view(select([0, 90, 180, 270], { label: "Rotation", value: 0 }));
```

```js
// "custom" is a template for your own dimensions (it takes `updates`), so it is left out here.
const specs = leagues(sport).filter((l) => l !== "custom");
const league = view(select(specs, { label: "League", value: specs.includes("nba") ? "nba" : specs[0] }));
const displayRange = view(select(displayRanges(sport), { label: "Show", value: "full" }));
```

```js
// the select gives a string
const turned = Number(rotation) % 180 !== 0;
const scene = surface(sport, league, { displayRange, rotation: Number(rotation) });
display(
  Plot.plot({
    ...surfaceScales(scene),
    width: turned ? Math.min(width, 380) : Math.min(width, 760),
    marks: surfaceMark(scene),
  }),
);
```

${sport} has ${specs.length} rule set${specs.length === 1 ? "" : "s"}, ${displayRanges(sport).length} display ranges and ${features(sport).length} features (from ${features(sport).slice(0, 3).join(", ")} to ${features(sport).at(-1)}).

## In a team's colours

`surface(league, { team })` from `@sportsdataverse/sdvplot/plot` paints a team's primary and secondary colours on the surface its league plays on (${Object.keys(SURFACES).length} leagues have one). **Centre logo** puts the team's logo at centre court.

```js
const teamLeague = view(select(Object.keys(SURFACES), { label: "League", value: "nfl" }));
const centerLogo = view(checkbox("Centre logo", { value: true }));
```

```js
const roster = (await teams(teamLeague)).filter((t) => t.name);
const team = view(
  select(
    roster.map((t) => t.name),
    { label: "Team", value: (roster.find((t) => t.abbr === "KC") ?? roster[0]).name },
  ),
);
```

```js
const painted = teamSurface(teamLeague, { team: roster.find((t) => t.name === team).team_id, centerLogo });
display(Plot.plot({ ...painted.scales, width: Math.min(width, 760), marks: painted.marks }));
```

## Real events on each surface

Every data source has its own coordinates. `toSurfaceFrame(rows, { from })` moves rows from a named frame into the surface's own (feet from the centre, for most surfaces), adding `surface_x` and `surface_y`. Pick a game; **Marks** draws each event as a dot in its team's colour, or a logo for each made shot, goal or touchdown.

- **NBA**: the fourth quarter of the Lakers at the Nuggets, 24 October 2023 (stats.nba.com `shotchartdetail`, game 0022300061; Denver won 119-107), from `nba-legacy`: tenths of a foot from the hoop.
- **NHL**: the first period of game 7 of the 2024 Stanley Cup Final, Edmonton at Florida (NHL api-web play-by-play, game 2023030417; Florida won 2-1). NHL api-web already reports feet from centre ice, so no frame is needed.
- **PWHL**: the four goals of Boston at Montreal, 2 March 2024 (HockeyTech `gameCenterPlayByPlay`, game 42; Montreal won 3-1), from `hockeytech`: pixels on a 600 x 300 canvas.
- **NFL**: the six offensive touchdowns of Super Bowl LIX, Kansas City at Philadelphia (ESPN `summary`, event 401671889; Philadelphia won 40-22), from `espn-football-0-100`: yards from the home team's goal line. ESPN gives no lateral position, so each play sits on the middle of the field.

```js
const GAMES = ["NBA: Lakers at Nuggets, Q4", "NHL: Stanley Cup Final game 7, P1", "PWHL: Boston at Montreal", "NFL: Super Bowl LIX touchdowns"];
const game = view(select(GAMES, { label: "Game", value: GAMES[0] }));
const markStyle = view(select(["dots", "dots and logos"], { label: "Marks", value: "dots and logos" }));
```

```js
const raw = {
  nba: await FileAttachment("data/nba_shots.json").json(),
  nhl: await FileAttachment("data/nhl_shots.json").json(),
  pwhl: await FileAttachment("data/pwhl_goals.json").json(),
  nfl: await FileAttachment("data/super_bowl_lix_tds.json").json(),
};
await Promise.all(["nba", "nhl", "pwhl", "nfl"].map((l) => loadLeague(l)));
```

```js
// each game: its league, the surface it was played on, its rows in the surface's frame, and which rows scored
const EVENTS = {
  [GAMES[0]]: {
    league: "nba",
    home: "DEN",
    rows: toSurfaceFrame(raw.nba, { from: "nba-legacy" }),
    scored: (r) => r.made,
    label: (r) => `${r.player} (${r.team}), ${r.shot_type}, ${r.made ? "made" : "missed"}`,
  },
  [GAMES[1]]: {
    league: "nhl",
    home: "FLA",
    rows: raw.nhl.map((r) => ({ ...r, surface_x: r.x, surface_y: r.y })),
    scored: (r) => r.type === "goal",
    label: (r) => `${r.team} ${r.type.replace(/-/g, " ")} at ${r.time}`,
  },
  [GAMES[2]]: {
    league: "pwhl",
    home: "MTL",
    rows: toSurfaceFrame(raw.pwhl, { from: "hockeytech" }),
    scored: () => true,
    label: (r) => `${r.scorer} (${r.team}), period ${r.period}, ${r.time}`,
  },
  [GAMES[3]]: {
    league: "nfl",
    home: "PHI",
    rows: toSurfaceFrame(raw.nfl.map((p) => ({ ...p, y: 0 })), { from: "espn-football-0-100", x: "yardline" }),
    scored: () => true,
    label: (r) => `${r.team} ${r.type}, Q${r.period} ${r.clock}, from the ${r.yardline}`,
  },
};
const ev = EVENTS[game];
const field = teamSurface(ev.league, { team: ev.home });
const at = { x: "surface_x", y: "surface_y", r: 5 };
display(
  Plot.plot({
    ...field.scales,
    width: Math.min(width, 860),
    color: teamColor(ev.league, { values: [...new Set(ev.rows.map((r) => r.team))], legend: true }),
    marks: [
      ...field.marks,
      Plot.dot(ev.rows.filter(ev.scored), { ...at, fill: "team", stroke: "white", title: ev.label, tip: true }),
      Plot.dot(ev.rows.filter((r) => !ev.scored(r)), {
        ...at,
        fill: "white",
        stroke: "team",
        strokeWidth: 2,
        title: ev.label,
        tip: true,
      }),
      markStyle === "dots and logos"
        ? logos(ev.rows.filter(ev.scored), { league: ev.league, x: "surface_x", y: "surface_y", team: "team", height: 0.07 })
        : null,
    ],
  }),
);
```

${ev.rows.length} events, ${ev.rows.filter(ev.scored).length} of them scoring; filled dots scored, white dots did not. Hover an event for what it was.
