---
title: Live scoreboard
---

# Live scoreboard with team colours

**The question:** what is on today, who is winning, and can it look like each team? A scoreboard widget for a site, a newsletter or a bot needs three things: the games, each team's mark, and two colours per game that read on the page and do not clash with each other.

**The workflow:** [sportsdataverse-js](https://js.sportsdataverse.org) fetches ESPN's scoreboard (`sdv.nba.espnNbaScoreboard({ parsed: true })` in Node). In your browser this page does the same thing with a plain `fetch` of the same ESPN URL and sdv-js's own parser, `parseEndpoint("espn", "scoreboard", raw)`, so the rows have the same columns either way: one row per game, with each side's ESPN id, abbreviation and score. sdvplot then gives every game its colours: `matchupColors` picks a pair that reads on this page and stays apart (a CIEDE2000 distance of at least 20), `onColor` picks black or white text on each, and `logoUrlSync` gives each team's mark. ESPN's team ids resolve in sdvplot as they are, so there is no lookup table.

By default the page draws a committed snapshot: the NBA's 17 March 2024 slate. Tick **Fetch live from ESPN** to fetch today's games for the league you pick; your browser makes the request, the page's build never does. Each card links to the [win-probability scrubber](./win-probability.html) (football) or the [game dashboard](./game-dashboard.html) (basketball) for that game.

```js
import { loadLeague, logoUrlSync, matchupColorsSync, onColor } from "./_sdv/sdvplot.js";
import { parseEndpoint } from "./_sdv/sdv-parsers.js";
import { checkbox, note, select } from "./components/controls.js";
import { SITE, espnJSON, params, source } from "./components/espn.js";
```

```js
const prov = await FileAttachment("data/sdvjs_provenance.json").json();
const snap = prov.snapshots.find((s) => s.name === "scoreboard_nba_20240317");
// ESPN's path for the league, and sdvplot's league name
const LEAGUES = {
  NBA: ["basketball/nba", "nba"],
  WNBA: ["basketball/wnba", "wnba"],
  NFL: ["football/nfl", "nfl"],
  "College football": ["football/college-football", "cfb"],
  NHL: ["hockey/nhl", "nhl"],
  MLB: ["baseball/mlb", "mlb"],
};
```

```js
const live = view(checkbox("Fetch live from ESPN", { value: params.has("live") }));
const league = view(select(Object.keys(LEAGUES), { label: "League (live)", value: params.get("league") ?? "NBA" }));
```

```js
const [path, sdvLeague] = LEAGUES[league];
const got = await espnJSON(`${SITE}/${path}/scoreboard`, {
  live,
  snapshot: FileAttachment("data/sdvjs_scoreboard_nba_20240317.json"),
});
// the snapshot is the NBA's, whatever league is picked
const lg = got.live ? sdvLeague : "nba";
const games = parseEndpoint("espn", "scoreboard", got.raw);
await loadLeague(lg);
display(source(got, snap));
```

```js
// a game's status: the tip-off time before it starts, ESPN's clock while it runs, "Final" after
const status = (g) =>
  g.status_type_state === "pre"
    ? new Date(g.date).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
    : g.status_type_short_detail;
const DASHBOARD = { nba: "game-dashboard", wnba: "game-dashboard", nfl: "win-probability", cfb: "win-probability" };

function card(g) {
  const [awayColor, homeColor] = matchupColorsSync(g.away_id, g.home_id, { league: lg })[dark ? "dark" : "light"];
  const el = document.createElement("article");
  el.style.cssText =
    "border: 1px solid var(--theme-foreground-faintest); border-radius: 8px; overflow: hidden; min-width: 0; background: var(--theme-background-alt)";
  for (const [side, color] of [["away", awayColor], ["home", homeColor]]) {
    const row = document.createElement("div");
    const won = g.status_type_completed && g[`${side}_winner`];
    row.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: ${color}; color: ${onColor(color)}; font-weight: ${won ? 700 : 400}`;
    const logo = Object.assign(document.createElement("img"), {
      src: logoUrlSync(g[`${side}_id`], lg) ?? g[`${side}_logo`],
      alt: g[`${side}_display_name`],
      width: 28,
      height: 28,
    });
    // a white disc behind the mark: a logo in its team's colour would vanish on that colour
    logo.style.cssText = "background: #fff; border-radius: 50%; padding: 2px; object-fit: contain; flex: none";
    const name = Object.assign(document.createElement("span"), { textContent: g[`${side}_abbreviation`] });
    name.style.flex = "1";
    const score = Object.assign(document.createElement("span"), {
      textContent: g.status_type_state === "pre" ? "" : g[`${side}_score`],
    });
    score.style.fontVariantNumeric = "tabular-nums";
    row.append(logo, name, score);
    el.append(row);
  }
  const foot = document.createElement("div");
  foot.style.cssText = "display: flex; justify-content: space-between; gap: 8px; padding: 6px 10px; font-size: 0.85em";
  foot.append(status(g));
  const page = DASHBOARD[lg];
  if (page) {
    // the dashboard opens live on this game, except the one game its snapshot already holds
    const snapshotGame = page === "game-dashboard" ? "401585607" : "401671789";
    const q = g.game_id === snapshotGame ? "" : `?live=1&league=${lg}&event=${g.game_id}`;
    foot.append(Object.assign(document.createElement("a"), { href: `./${page}.html${q}`, textContent: page === "game-dashboard" ? "Dashboard →" : "Win probability →" }));
  }
  el.append(foot);
  return el;
}

const grid = document.createElement("div");
grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px";
grid.append(...games.map(card));
const counts = ["pre", "in", "post"].map((s) => games.filter((g) => g.status_type_state === s).length);
display(games.length ? grid : note(`ESPN lists no ${league} games today.`));
```

${games.length} game${games.length === 1 ? "" : "s"}: ${counts[2]} final, ${counts[1]} in progress, ${counts[0]} still to start. The cards follow the page's colour scheme: switch your system between light and dark and each pair is recomputed for the new background.

## What to take from it

- **The browser can be the client.** ESPN's site API sends `Access-Control-Allow-Origin: *`, so a page can fetch it directly, with no proxy and no server. One catch for anyone testing it headless: `site.api.espn.com` leaves that header out when the user agent says `HeadlessChrome`, so an automated check must send a normal Chrome user agent.
- **One parser, two runtimes.** sdv-js's parsers are browser-safe (`sportsdataverse/parsers`); this page uses that bundle, vendored at a pinned commit and sha256. The rows a Node script gets from `espnNbaScoreboard({ parsed: true })` and the rows this page draws are the same rows.
- **Pairs, not single colours.** Two teams' primary colours often clash (two reds, two navies). `matchupColors` checks the pair against the page's background and against each other, falling back to a secondary colour or a lighter shade only when it must.

**Script it in Node:** sdv-js's [nightly scores card](https://js.sportsdataverse.org/docs/tutorials/sdvplot-scores-card) draws the same slate as a PNG with `socialCard` and posts it from a GitHub Action.
