---
"@sportsdataverse/sdvplot": minor
---

Conference and league rows stay out of the team listings, as in sdvplot and sdvplotR: `teams()`, `loadLeague()`'s `teams`, palettes, team colours and every other team listing skip a row whose `program` is `"conference"`, `"league"` or `"division"`, and `teams(league, { includeConferences: true })` lists them too. The bundled index has no such rows yet, so nothing changes today; the next index update brings them.
