---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/recharts`: Recharts render props that draw team logos and player headshots as a series' `dot` / `shape` (`logoDot`, `headshotDot`, with `last` for an end-dot), team logos as an axis' `tick` (`logoTick`, unresolved categories keep their text), and `teamColorPalette` (with `background`, every colour keeps 3:1 contrast and aims to stay distinct from the others, CIE76 ΔE 20 or more, for dark mode; when no candidate is both, it keeps the readable colour and warns once), plus `embedSources`. It never imports recharts, a new optional peer (>= 3.8, the oldest tested; 3.2 to 3.7 break server rendering or draw a reversed axis mirrored). `sdvplot/react` adds `<SurfaceBackdrop>`, a team-painted court, field or rink under a Recharts chart, which loads recharts and `@sportsdataverse/sporty` only when it first renders.
