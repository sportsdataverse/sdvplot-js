---
"@sportsdataverse/sporty": minor
---

`@sportsdataverse/sporty/canvas` renderer (`drawScene`, `SceneCanvasContext`; DOM-free, takes a browser 2D context or an `@napi-rs/canvas` one in Node); `toSVG` gains `arcs: "svg"`, which replaces detected circle runs with SVG `A` commands (one per quarter turn).
