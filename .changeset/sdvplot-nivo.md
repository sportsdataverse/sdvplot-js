---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/nivo`: `teamColors`, a nivo `colors` accessor that draws each Bump series, Chord arc or SwarmPlot node in its team's colour (with `background` and `teams`, every colour keeps 3:1 contrast and aims to stay distinct from the others, CIE76 ΔE 20 or more, for dark mode; when no candidate is both, it keeps the readable colour and warns once); `logoLayer`, a custom layer of team logos at a Bump's line ends (or every point), a SwarmPlot's nodes or outside a Chord's arcs, sized as a fraction of the plot height; and `logoNode`, logos as a SwarmPlot's `circleComponent` or a Bump's `pointComponent`; plus `embedSources`. It never imports nivo: `@nivo/core`, `@nivo/bump`, `@nivo/swarmplot` and `@nivo/chord` are new optional peers (>= 0.99). `sdvplot/react` adds `<LogoBump>`, a nivo bump chart with team-coloured lines and a logo at the end of each line, which loads `@nivo/bump` only when it first renders.
