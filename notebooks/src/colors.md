---
title: Team colours
---

# Team colours

Every team's primary colour in one league, from the bundled index; each label is in the ink `onColor` picks for its swatch. Then pick two teams and check the pair.

```js
import * as Plot from "@observablehq/plot";
import { LEAGUES, contrast, onColor, palette } from "./_sdv/sdvplot.js";
import { select } from "./components/controls.js";
```

```js
const league = view(select(LEAGUES, { label: "League", value: "nfl" }));
```

```js
// palette(league): { team: primary colour }, keyed by abbreviation (by team_id where an abbreviation is shared).
const colors = Object.entries(await palette(league)).map(([team, color]) => ({ team, color }));
const at = { x: (_, i) => i % 8, y: (_, i) => Math.floor(i / 8) };
```

```js
display(
  Plot.plot({
    height: 20 + 36 * Math.ceil(colors.length / 8),
    axis: null,
    marks: [
      Plot.cell(colors, { ...at, fill: "color", inset: 1, title: (d) => `${d.team} ${d.color}` }),
      Plot.text(colors, { ...at, text: "team", fill: (d) => onColor(d.color) }),
    ],
  }),
);
```

## A pair

The WCAG contrast ratio between two teams' primary colours: 1 is the same colour, 21 is black on white. For a chart of one team against another, `matchupColors` picks the pair for you.

```js
const names = colors.map((d) => d.team);
const a = view(select(names, { label: "Team", value: names.includes("KC") ? "KC" : names[0] }));
const b = view(select(names, { label: "against", value: names.includes("PHI") ? "PHI" : names[1] }));
```

```js
const pair = [a, b].map((team) => colors.find((d) => d.team === team));
display(
  Plot.plot({
    height: 70,
    axis: null,
    marks: [
      Plot.cell(pair, { x: (_, i) => i, fill: "color" }),
      Plot.text(pair, { x: (_, i) => i, text: (d) => `${d.team} ${d.color}`, fill: (d) => onColor(d.color) }),
    ],
  }),
);
```

${a} against ${b}: contrast ${contrast(pair[0].color, pair[1].color).toFixed(2)}:1.
