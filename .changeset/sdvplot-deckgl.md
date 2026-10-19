---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/deckgl`: deck.gl layer props. `logoIconLayer` draws team logos at points (`IconLayer` props with auto-packed logo icons, centred, sized in px; a team with no logo is left out with one warning), `passArcLayer` draws arcs in team colours (`ArcLayer` props: the primary colour at the source, the secondary at the target; with `background`, every colour keeps 3:1 contrast and stays CIE76 ΔE 20 apart through the shared team palette; `tilt: 90` lays the arcs flat for a top-down view and `height` sets how far they swing), and `surfaceLayer(sport, league)` draws a sporty surface as `PolygonLayer` props in its own `"cartesian"` coordinates. It never imports deck.gl; `@deck.gl/core` and `@deck.gl/layers` (>= 9.4.0) are new optional peers. The Python package's `sdvplot.pydeck` builds the same props, held to one shared fixture (`fixtures/deckgl/shared.json`).
