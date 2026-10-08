---
"@sportsdataverse/sdvplot": minor
---

`sdvplot/export` (Node): `toPNG(svg, { width, scale, background, color, images })` rasterizes an SVG figure with the optional peer `@resvg/resvg-js`, downloading its remote logos and headshots (`DownloadError` on a failed download; `images: "skip"` leaves them out). `socialCard(svg, { aspect, padding, background, gravity, color })` frames it on a fixed-ratio canvas as `gt_social_crop` does. Helpers: `svgSize`, `parseAspect`, `parseGravity`, `checkColor`, `canvasFor`, `offsetFor`, `peerMissing`. New error class `OptionalDependencyError` for a missing optional peer.
