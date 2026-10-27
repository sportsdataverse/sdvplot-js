---
"@sportsdataverse/sdvplot": minor
---

New subpath `@sportsdataverse/sdvplot/g2` for AntV G2 5 and so for Ant Design Charts (`@ant-design/plots`), whose configs are G2 specs underneath. `teamColorScale(league, teams, o)` returns G2's `scale.color` (`{ domain, range }`) and `teamColorPalette` the colours alone; with `background` they keep 3:1 contrast on it (dark mode). `logoMark`, `wordmarkMark` and `headshotMark(rows, o)` return a G2 `image` mark, `size` px tall and centred on each row's x/y fields, for a view's `children` or an Ant Design Charts config's `annotations`; a team or player with no image draws nothing and warns once. `axisLogos(o)` puts logos on a horizontal band axis through G2's `labelRender` (HTML labels; a category with no logo keeps its text). `drawnMarks(spec)` reads back what the marks draw. It never imports G2; `@antv/g2` >= 5.4.8 is an optional peer.
