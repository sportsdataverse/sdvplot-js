---
"@sportsdataverse/sdvplot": patch
---

`surfaceLayer` (`/deckgl`) and `surfaceMesh` (`/three`) draw sporty's sportyR 2.4.5 rink: each NHL goaltender trapezoid is two strips (4 rows or loops, was 6 pieces of a ring that crossed itself), and the faceoff hash marks are 16 loops (were 24 after splitting the 8 that crossed). The deck.gl fixture shared with sdvplot (Python), `fixtures/deckgl/shared.json`, changes with it (`goaltenders_restricted_area`: 4 rows).
