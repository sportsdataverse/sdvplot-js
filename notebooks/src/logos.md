---
title: Logos by league
---

# Logos by league

Every team the bundled index knows for one league, with the logo it wore in a season. Pick a league and a season; the page loads that league's data only.

```js
import * as Plot from "@observablehq/plot";
import { LEAGUES, logoUrlSync, teams } from "./_sdv/sdvplot.js";
import { range, select } from "./components/controls.js";
```

```js
const league = view(select(LEAGUES, { label: "League", value: "nfl" }));
const season = view(range([1990, 2025], { label: "Season", value: 2024 }));
```

```js
const rows = (await teams(league))
  .map((t) => ({ name: t.name, src: logoUrlSync(t.team_id, league, { season }) }))
  .filter((t) => t.src !== undefined);
```

```js
display(
  Plot.plot({
    height: 40 + 60 * Math.ceil(rows.length / 10),
    axis: null,
    // point scales keep a half-step of padding, so the edge logos are not cut by the frame
    x: { type: "point" },
    y: { type: "point" },
    marks: [Plot.image(rows, { x: (_, i) => i % 10, y: (_, i) => Math.floor(i / 10), src: "src", title: "name", width: 48 })],
  }),
);
```

${rows.length} ${league} teams have a logo for ${season}.
