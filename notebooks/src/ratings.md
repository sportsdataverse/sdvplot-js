---
title: Season ratings scatter
---

# Season ratings scatter with logos

**The question:** which teams were actually good, and which were lucky? Wins and losses are noisy; points scored and allowed per game say more about a team's strength. Plotting the two against each other, with each team as its logo, shows the whole league at once: up and to the right is good at both ends.

**The workflow:** [sportsdataverse-js](https://js.sportsdataverse.org) reads ESPN's standings (`sdv.nba.espnNbaStandings({ season: 2025, parsed: true })` in Node; the same parser on the same JSON here). Each row is a team with its conference, record, and points for and against per game (`avg_points_for`, `avg_points_against`). sdvplot draws the scatter with `logos` and `meanLines`, and ranks the teams by point differential per game with `teamTiers`. ESPN's team ids resolve in sdvplot as they are.

The snapshot is the final 2024-25 NBA regular season (ESPN `season=2025`). Tick **Fetch live from ESPN** to load another season, or leave **Season** blank for the one ESPN serves now (early in a season the sample is small, so the points cluster).

```js
import * as Plot from "@observablehq/plot";
import { loadLeague } from "./_sdv/sdvplot.js";
import { logos, meanLines, teamTiers } from "./_sdv/sdvplot-plot.js";
import { parseEndpoint } from "./_sdv/sdv-parsers.js";
import { checkbox, note, select, text } from "./components/controls.js";
import { espnJSON, params, source } from "./components/espn.js";
```

```js
const prov = await FileAttachment("data/sdvjs_provenance.json").json();
const snap = prov.snapshots.find((s) => s.name === "standings_nba_2025");
```

```js
const live = view(checkbox("Fetch live from ESPN", { value: params.has("live") }));
const season = view(text("Season (live; blank = current)", { value: params.get("season") ?? "", placeholder: "e.g. 2024", size: 8 }));
```

```js
const got = await espnJSON(
  `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings${season ? `?season=${encodeURIComponent(season)}` : ""}`,
  { live, snapshot: FileAttachment("data/sdvjs_standings_nba_2025.json") },
);
const teams = parseEndpoint("espn", "standings", got.raw).map((t) => ({
  team: t.team_id,
  name: t.team_display_name,
  conf: t.group_abbreviation,
  pf: t.avg_points_for,
  pa: t.avg_points_against,
  diff: t.avg_points_for - t.avg_points_against,
  record: `${t.wins}-${t.losses}`,
}));
const label = got.raw.season?.displayName ?? got.raw.season?.year ?? "";
await loadLeague("nba");
display(source(got, snap));
```

${teams.length} teams, season ${label}. Best point differential: ${[...teams].sort((a, b) => b.diff - a.diff).slice(0, 3).map((t) => `${t.name} (${t.diff >= 0 ? "+" : ""}${t.diff.toFixed(1)}, ${t.record})`).join(", ")}.

```js
const conf = view(select(["Both", ...new Set(teams.map((t) => t.conf))], { label: "Conference", value: "Both" }));
```

```js
const shown = conf === "Both" ? teams : teams.filter((t) => t.conf === conf);
const [lo, hi] = [Math.min(...teams.flatMap((t) => [t.pf, t.pa])), Math.max(...teams.flatMap((t) => [t.pf, t.pa]))];
display(
  teams.some((t) => t.pf > 0)
    ? Plot.plot({
        width,
        height: Math.min(560, Math.max(360, width * 0.7)),
        grid: true,
        inset: 24,
        x: { label: "Points scored per game →" },
        y: { label: "↑ Points allowed per game (reversed)", reverse: true },
        marks: [
          // break-even: above this line a team outscores its opponents
          Plot.line([[lo, lo], [hi, hi]], { strokeDasharray: "4,4", strokeOpacity: 0.5 }),
          meanLines(shown, { x: "pf", y: "pa" }),
          logos(shown, {
            league: "nba",
            x: "pf",
            y: "pa",
            team: "team",
            height: 0.07,
            variant: dark ? "dark" : "default",
            title: (t) => `${t.name} ${t.record}\n${t.pf.toFixed(1)} scored, ${t.pa.toFixed(1)} allowed (${t.diff >= 0 ? "+" : ""}${t.diff.toFixed(1)})`,
          }),
        ],
      })
    : note("No games played yet in this season."),
);
```

The dashed diagonal is break-even: a team above it outscored its opponents. The solid lines are the means of the teams shown. Hover a logo for its numbers.

## Tiers by point differential

`teamTiers` ranks the same teams within bands of point differential per game: +6 or better, +2 to +6, within 2 of even, −2 to −6, and worse than −6.

```js
const band = (d) => (d >= 6 ? 1 : d >= 2 ? 2 : d > -2 ? 3 : d > -6 ? 4 : 5);
const tierRows = shown
  .map((t) => ({ team: t.team, tier_no: band(t.diff), diff: t.diff }))
  // row order is rank order within a tier: best differential first
  .sort((a, b) => a.tier_no - b.tier_no || b.diff - a.diff);
display(
  Plot.plot(
    teamTiers(tierRows, {
      league: "nba",
      width: Math.min(width, 760),
      theme: dark ? "dark" : "light",
      title: `NBA point differential per game, ${label}`,
      subtitle: conf === "Both" ? "Every team" : `${conf}ern Conference`,
      tierDesc: { 1: "+6 or better", 2: "+2 to +6", 3: "Even (±2)", 4: "-2 to -6", 5: "Worse than -6" },
      caption: "data: ESPN standings via sportsdataverse-js",
      tip: true,
    }),
  ),
);
```

## What to take from it

- **Differential beats the record.** Points scored minus points allowed per game is a steadier measure of a team than its win-loss record, which close games bend. In the 2024-25 snapshot, Oklahoma City's +12.9 led Cleveland's +9.5 by 3.4 points a game, yet the two finished only four wins apart (68-14 and 64-18).
- **Reverse the "allowed" axis.** With points allowed reversed, up is good on both axes, so the top-right corner holds the teams that are good at both ends and the bottom-left the teams that are bad at both.
- **The same rows feed both charts.** One parse of the standings drives the scatter and the tiers; switching the conference re-filters the rows, not the requests.

**Script it in Node:** sdv-js's [standings table tutorial](https://js.sportsdataverse.org/docs/tutorials/sdvplot-standings-table) turns ESPN standings into a publication table PNG, and its [WNBA standings tutorial](https://js.sportsdataverse.org/docs/tutorials/sdvplot-standings-colors) colours them by team. The [Logos by league](./logos.html) notebook covers `logos`, `meanLines` and `axisLogos`.
