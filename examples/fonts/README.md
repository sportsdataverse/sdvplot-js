# Fonts the examples draw with

- `SourceSans3-Regular.ttf`: Source Sans 3 Regular by Adobe, SIL Open Font License 1.1 (`OFL.txt` is the font's own
  `LICENSE.md`). From https://github.com/adobe-fonts/source-sans `release` branch @ 87b37a2, `TTF/SourceSans3-Regular.ttf`,
  sha256 4644c81b86ec9caaa76b634889968ed3c4f4f52f054855933acc7c2b21e53b0f, fetched 2026-10-08. The Chart.js PNG
  examples register it with `GlobalFonts.registerFromPath`, because a build host (Vercel) may have no system fonts
  and `@napi-rs/canvas` would then draw every label blank.
