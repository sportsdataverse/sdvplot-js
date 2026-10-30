---
"@sportsdataverse/sdvplot": minor
"@sportsdataverse/sdvtables": minor
---

The peer ranges on the other sdvplot-js packages publish as `>=0.2.0 <1` instead of `^0`: sdvtables needs sdvplot 0.2 (its `/mui` and `/aggrid` import `sdvplot/mui` and `sdvplot/tanstack`, which sdvplot 0.1 lacks), and sdvplot asks for sporty 0.2. A later 0.x release of either still satisfies the range.
