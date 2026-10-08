---
"@sportsdataverse/sdvplot": minor
---

Team identity for every SportsDataverse league: `resolve`/`suggest` (100% parity with the Python sdvplot package on 8,403 real inputs), team colours and palettes, logo, wordmark and headshot URLs, and the React primitives `TeamLogo`, `Wordmark` and `Headshot`. League data loads lazily per league; the 3.4 MB nflverse gsis-id map loads only through `loadGsis()` (or `preloadAll()`). Warnings go through one once-per-key channel (`warn`, `setWarningHandler`, `resetWarnings`), which `@sportsdataverse/sdvtables` shares.
