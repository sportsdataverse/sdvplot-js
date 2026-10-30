---
"@sportsdataverse/sporty": patch
---

`toSVG`, `drawScene` (`/canvas`), `appendSurface` (`/d3`) and `sceneToGeoJSON`/`surfaceMark` (`/plot`) fill each closed ring of a feature as its own sub-path, wound so a ring inside another is a hole and any other ring is filled once. sportyR fills the nhl92 crease's band and L-marks (and the goaltender trapezoid's two strips) as separate polygons; drawn as one joined path, the OHL and QMJHL creases showed a red triangle inside them. The lacrosse contrasting centre marker also matches a centre line given as a CSS colour name or short hex (`"white"`, `"#fff"`).
