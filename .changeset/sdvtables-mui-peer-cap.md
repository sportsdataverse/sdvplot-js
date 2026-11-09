---
"@sportsdataverse/sdvtables": patch
---

The `@mui/x-data-grid` peer range is now `>=9.15.0 <10`. The MUI X adapter (`/mui`) styles the grid through v9's CSS variables and class names, which MUI doesn't document as stable, so v10 is outside the supported range. Depending on the package manager and its settings, installing v10 now gives a peer-dependency warning or error.
