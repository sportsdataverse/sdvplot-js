---
"@sportsdataverse/sdvplot": minor
---

`surface()` (plot, chartjs/surface) and `appendSurface()` (d3) take every key of the SDV surface table shared with sdvplot and sdvplotR: baseball (`mlb`, `milb`, `ncaa_baseball`, `little_league`, `pony`, `nfhs_baseball`), `ncaa_softball`, soccer (`soccer` at 105 x 68 m, `fifa`, `epl`, `mls`, `nwsl`, `ncaa_soccer`), `fiba`, `nfhs_basketball`, `cfl`, `nfhs_football`, `iihf`, `nwhl`, lacrosse, tennis, volleyball and curling. A `team` on a key that is not an sdv team league (`atp`, `fiba`, `nll`, ...) throws `InputError`. `SURFACES` and `colorUpdates` cover all ten sporty sports; sports without a team painting take no colours.
