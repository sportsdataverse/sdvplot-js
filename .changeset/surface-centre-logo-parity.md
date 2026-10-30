---
"@sportsdataverse/sdvplot": minor
---

`surface(league, { team, centerLogo })` puts the logo where sdvplotR and sdvplot (Python) do. On a baseball or softball field, whose origin is home plate, the logo now goes in shallow centre field (x = 0, midway between second base and the centre-field fence) and `centerLogo: true` sizes it 0.15 of the centre-field distance across: 60 ft at 263.6 ft from home plate on an MLB field, where it used to sit on home plate. On grass (football, soccer, baseball, softball) the logo is the team's dark-background variant. The logo now moves with `xTrans` and `yTrans` as the surface does. `SURFACE_BASE` gains the soccer, baseball and softball colours.
