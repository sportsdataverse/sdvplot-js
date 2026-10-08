---
title: Playing surfaces
---

# Playing surfaces

Every court, field, rink and pitch sporty draws, as Observable Plot marks. Pick a sport, one of its rule sets, how much of the surface to show and a rotation.

```js
import * as Plot from "@observablehq/plot";
import { loadLeague, teams } from "./_sdv/sdvplot.js";
import { SURFACES, logos, surface as teamSurface, teamColor } from "./_sdv/sdvplot-plot.js";
import { SPORTS, displayRanges, leagues, surface, toSurfaceFrame } from "./_sdv/sporty.js";
import { surfaceMark, surfaceScales } from "./_sdv/sporty-plot.js";
import { select } from "./components/controls.js";
```

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
const scene = surface(sport, league, { displayRange, rotation: Number(rotation) });
display(Plot.plot({ ...surfaceScales(scene), width: Number(rotation) % 180 ? 360 : 720, marks: surfaceMark(scene) }));
```

## In a team's colours

`surface` from `@sportsdataverse/sdvplot/plot` paints a team's colours on the surface of its league.

```js
const teamLeague = view(select(Object.keys(SURFACES), { label: "League", value: "nfl" }));
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
const painted = teamSurface(teamLeague, { team: roster.find((t) => t.name === team).team_id, centerLogo: true });
display(Plot.plot({ ...painted.scales, width: 720, marks: painted.marks }));
```

## Real shots

The fourth quarter of the Lakers at the Nuggets on 24 October 2023 (stats.nba.com `shotchartdetail`, game 0022300061; Denver won 119-107), on a Nuggets court. Made shots are filled in the shooting team's colour, misses are white, and a logo marks each made three. stats.nba.com gives each shot in tenths of a foot from the hoop; `toSurfaceFrame` moves it into the court's frame.

```js
await loadLeague("nba");
const shots = toSurfaceFrame(await FileAttachment("data/nba_shots.json").json(), { from: "nba-legacy" });
const court = teamSurface("nba", { team: "DEN", displayRange: "defense" });
const at = { x: "surface_x", y: "surface_y", r: 5 };
display(
  Plot.plot({
    ...court.scales,
    width: 720,
    color: teamColor("nba", { values: shots.map((s) => s.team), legend: true }),
    marks: [
      ...court.marks,
      Plot.dot(shots.filter((s) => s.made), { ...at, fill: "team", stroke: "white" }),
      Plot.dot(shots.filter((s) => !s.made), { ...at, fill: "white", stroke: "team", strokeWidth: 2 }),
      logos(shots.filter((s) => s.made && s.shot_type === "3PT Field Goal"), {
        league: "nba",
        x: "surface_x",
        y: "surface_y",
        team: "team",
        height: 0.08,
      }),
    ],
  }),
);
```

${shots.length} shots: ${shots.filter((s) => s.made).length} made.
