---
"@sportsdataverse/sdvplot": patch
---

Pre-publish trims: the nflverse gsis map is a lazy chunk behind `loadGsis()` (also loaded by `preloadAll()`) instead of 3.4 MB in the shared chunk; mark shards no longer store `archive_url` (derived from sha256 + ext, and the generator drops any manifest row whose URL is not the content-addressed one); no source maps for generated data chunks; `resolve` builds the team-name map only for an ambiguous-match message.
