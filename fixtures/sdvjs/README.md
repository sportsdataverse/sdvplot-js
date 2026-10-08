# sdv-js snapshots

The data of the five "Workflows with sdv-js" notebooks (`notebooks/src/{scoreboard,win-probability,game-dashboard,ratings,player-trend}.md`).
Each `<name>.json.gz` is one ESPN response exactly as served, gzipped (zlib level 9); `provenance.json` records its
URL, the sportsdataverse-js call that makes the same request, the capture time (UTC), the size and sha256 of the body
as served (after gunzip), and, for each parse its page runs, the row count and the sha256 of `JSON.stringify(rows)`.
Nothing here is hand-written. `notebooks/scripts/snapshot-sdvjs.ts` writes both (it is never run by a build).

| Snapshot | Request | Captured (UTC) | Bytes | sha256 (as served) | Rows |
| --- | --- | --- | --- | --- | --- |
| `scoreboard_nba_20240317` | `GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20240317` | 2026-10-08T23:31:12Z | 99,102 | `65ba07b2…e459f168` | scoreboard 7 |
| `summary_nfl_401671789` | `GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401671789` (Baltimore at Kansas City, 2024-09-05, 20-27) | 2026-10-08T23:31:13Z | 471,570 | `dbd4ff54…aa2cb5b` | header 1, winprobability 188, drive_plays 188 |
| `summary_nba_401585607` | `GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401585607` (Toronto at Orlando, 2024-03-17, 96-111) | 2026-10-08T23:31:13Z | 370,326 | `4dcfa422…c5ad7d346` | header 1, plays 450, boxscore_player 27 |
| `standings_nba_2025` | `GET https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2025` (the final 2024-25 standings) | 2026-10-08T23:31:13Z | 171,217 | `bedd4e42…13b50d86` | standings 30 |
| `athlete_gamelog_nba_1966_2024` | `GET https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/1966/gamelog?season=2024` (LeBron James, 2023-24) | 2026-10-08T22:58:10Z | 787,166 | `a71cffd3…52464695` | athlete_gamelog 82 |

The game log is one capture shared with sportsdataverse-js: it is that repository's
`test/fixtures/espn/athlete_gamelog_nba_1966_2024.json.gz` (captured through
`sdv.nba.espnNbaPlayerGamelog({ athlete_id: '1966', season: 2024 })`, the fixture of its player-form tutorial),
recorded here with `snapshot-sdvjs.ts --from`; the sha256 of the gunzipped bytes is the same in both repositories.

## What a page reads

`notebooks/scripts/build.ts` writes each page's attachment (`notebooks/src/data/sdvjs_<name>.json`) from the
response: the top-level keys in its `keep` list and, for the game log (`cut_links`), every `links` array dropped
(they are most of its bytes). `examples/test/sdvjs-snapshots.test.ts` checks, for every snapshot, that the body hashes
to its recorded sha256 and that both the whole response and the page's cut parse to rows with the recorded sha256. It
then runs the pages' own data steps (`notebooks/src/components/workflows.js`) on the snapshots and re-derives what the
pages state: the 2024-03-17 slate, the 27-20 final and its win-probability swings, one athlete-id type on both sides of
the dashboard's join with every player's charted attempts equal to the box score's FGA, Oklahoma City's +12.9, and the
71 games and 1,822 points of LeBron James's 2023-24 regular season.

## The parser

`notebooks/vendor/sdv-parsers.js` is sportsdataverse-js's browser-safe parser bundle (`sportsdataverse/parsers`,
`docs/src/playground/parsers.bundle.mjs` at sportsdataverse-js a9c7eb8), verbatim below a header comment. Its sha256
(of the bytes below the header) is pinned in `provenance.json`; the build and the test refuse a copy that differs. The
build minifies it into `notebooks/src/_sdv/sdv-parsers.js`; in the reader's browser it parses the snapshot and a live
response alike, and the test runs it in Node.

## Refreshing

```sh
cd notebooks && npx tsx scripts/snapshot-sdvjs.ts                     # every snapshot, from ESPN
npx tsx scripts/snapshot-sdvjs.ts standings_nba_2025                     # one
```

A refresh changes the pages' facts, so rerun the test and update the prose it checks.
