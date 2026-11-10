---
"@sportsdataverse/sdvplot": minor
---

`resolve()` reads the new id systems, in sdvplot's order: `"auto"` tries Yahoo's dotted ids (`"ncaaf.t.1"`, `"nba.t.1"`) and KenPom and Torvik team names before `"sdvplotr"` and `"name"`; Fox, CBS, 247Sports and On3 ids resolve only with an explicit `idSystem` (their numbers are other teams' ESPN ids). Team values fold the eight Latin letters NFKD leaves whole (`ø` to `o`, `æ` to `ae`, `œ` to `oe`, `đ` and `ð` to `d`, `ł` to `l`, `þ` to `th`, `ı` to `i`): `"HB Køge"` is `"HB Koge"`.
