---
"@sportsdataverse/sporty": patch
---

The nhl98 goal crease outline's inner arc now ends exactly on its inner straight sides instead of about 4e-16 ft across them, so a renderer that splits rings where they cross (sdvplot's deck.gl `surfaceLayer`) no longer drops the crease's corner points.
