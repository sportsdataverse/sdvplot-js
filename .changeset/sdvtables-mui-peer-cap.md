---
"@sportsdataverse/sdvtables": patch
---

The `@mui/x-data-grid` peer range is now `>=9.15.0 <10`. The MUI X adapter (`/mui`) styles the grid through v9's CSS variables and class names, which MUI doesn't document as stable, so a v10 install now gets a peer warning instead of an unstyled grid.
