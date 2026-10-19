# deck.gl / pydeck shared fixture

`shared.json` is written by `pnpm oracle:deckgl` (`tools/oracle/deckgl.ts`; build sporty first,
`pnpm --filter @sportsdataverse/sporty build`) from this repo's `./deckgl` adapter. Never hand-edit it. The Python
package [sdvplot](https://github.com/sportsdataverse/sdvplot) commits the same bytes as `tests/fixtures/deckgl_shared.json`,
and both repos' tests pin its sha256 (`packages/sdvplot/test/deckgl-shared.test.ts` here, `tests/test_pydeck_shared.py`
there): `sdvplot.pydeck` must rebuild every value in it, so a test failure there is a difference between the two
languages. After regenerating, copy the file into sdvplot and update the digest in both tests.

- **Inputs (real rows):** the 27 period-1 shots of game 7 of the 2024 Stanley Cup Final (NHL api-web play-by-play,
  `examples/src/data.ts` `NHL_SHOTS`, checked against `fixtures/examples/nhl_pbp_2023030417_p1_shots.json`), each with
  the goal at its end of the rink (`net_x` = ±89 ft, `net_y` = 0); France's 75 completed first-half passes in the 2018
  World Cup final (StatsBomb open data, event file 8658, through SPADL: `WC2018_FINAL_FRANCE_PASSES`, checked against
  `fixtures/examples/spadl_8658_france_h1_passes.csv`), team ESPN 478; and the archive's manifest rows of the Edmonton
  and Florida logos (the Python test serves them as its manifest).
- **Layers:** six `logoIconLayer` / `passArcLayer` cases, each with its options, its props (an accessor written as the
  name of the row field it returns) and its data, exactly.
- **Surfaces:** the NHL rink and a 105 x 68 m FIFA pitch: the props, every fill colour, and the extent. The vertices
  are not shared: sporty and sportypy sample arcs differently. The rink has no `extent_y`: sportypy 1.0 sets the
  penalty boxes 0.4167 ft nearer centre ice than sporty does, so the two rinks' lowest points differ.
- **Palettes:** the shared team palette (`src/team-palette.ts`, ported to Python as `sdvplot._team_palette`) on every
  NBA, NFL, MLB and NHL team, in each league's standard order, on `#181a1b`, `#000000` and `#ffffff`: the inputs and
  the colours it returns.

Generated 2026-10-18 from sdvplot index `1c025b69f8cf`, with no warning.
