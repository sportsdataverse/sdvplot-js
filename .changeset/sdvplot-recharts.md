---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/recharts`: Recharts render props that draw team logos and player headshots as a series' `dot` / `shape` (`logoDot`, `headshotDot`, with `last` for an end-dot), team logos as an axis' `tick` (`logoTick`, unresolved categories keep their text), and `teamColorPalette` (with `background`, every colour keeps 3:1 contrast and stays distinct from the others, CIE76 ΔE 10 or more, for dark mode), plus `embedSources`. It never imports recharts, a new optional peer (>= 3.2). `sdvplot/react` adds `<SurfaceBackdrop>`, a team-painted court, field or rink under a Recharts chart, which loads recharts and `@sportsdataverse/sporty` only when it first renders.
