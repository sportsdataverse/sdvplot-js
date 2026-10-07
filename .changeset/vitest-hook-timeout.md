---
"@sportsdataverse/sdvtables": patch
"@sportsdataverse/sdvplot": patch
---

Raise vitest `hookTimeout` to 60 s in both packages: the `preloadAll()` `beforeAll` hooks exceeded the 10 s default under CI load (PR #17 ran red on both Node jobs with every test passing).
