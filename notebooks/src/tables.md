---
title: Table themes
---

# Table themes

The 2024 AFC West and East under each sdvtables theme and density: the same spec, rendered to HTML by `renderHTMLAsync`. Logos and quarterback headshots load from the archive and ESPN.

```js
import { THEME_NAMES, defineTable } from "./_sdv/sdvtables.js";
import { renderHTMLAsync } from "./_sdv/sdvtables-html.js";
import { select } from "./components/controls.js";
```

```js
// Every value is from the 2024 regular season (nflverse); examples/src/data.ts gives each column's source.
const standings = await FileAttachment("data/standings.json").json();
```

```js
const theme = view(select(THEME_NAMES, { label: "Theme", value: "sdv" }));
const density = view(select(["comfortable", "compact", "social"], { label: "Density", value: "comfortable" }));
const team = view(select(standings.map((r) => r.team), { label: "sdvTeam colours", value: "KC" }));
```

```js
const spec = defineTable()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true }),
    c.headshot("qb_espn_id", { league: "nfl", label: "QB" }),
    c.text("qb", { label: "" }),
    c.int("wins"),
    c.int("losses"),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
    c.num("net_epa", { label: "Net EPA/play", digits: 3, forceSign: true }),
  ])
  // sdvTeam takes its header colour from a team; the other themes ignore the team.
  .theme(theme, theme === "sdvTeam" ? { density, options: { league: "nfl", team } } : { density })
  .title("AFC West and East, 2024")
  .subtitle(`theme "${theme}", density "${density}"`)
  .build();
display(Object.assign(document.createElement("div"), { innerHTML: await renderHTMLAsync(spec, standings) }));
```
