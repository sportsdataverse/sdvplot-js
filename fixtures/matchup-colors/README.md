# matchupColors oracle fixtures

Game on Paper's own `pickGameColors`, run on real college-football matchups; `matchupColors` must return
the same hexes for every pair, light and dark (`packages/sdvplot/test/matchup-colors.test.ts`). Never
hand-edit; a parity failure is a port bug.

- Game on Paper commit: `b8b8eaad2fd4641fd2bbfcfa0591d6e57bf5524e` (`game-on-paper-app`, file
  `astro/src/utils/misc.ts`, read with `git show <sha>:<file>`; the working tree is never touched). The
  copy has its four `import` lines removed (they feed unrelated functions only) and
  `export { hexToLab, lab2rgb, rgbArrayToHex }` appended so the oracle can find the "deep" games below;
  the code that produces `expected` is unchanged.
- Matchups: completed games in `cfbfastR-cfb-raw` `cfb/schedules/csv/cfb_schedule_{2004..2026}.csv`
  (commit `95c155b6cb68cefc15ca0f7f366748e643fdfad9`): 5,043 distinct team pairs where sdvplot has a colour
  for both teams, each kept at its most recent meeting.
- Colour inputs: the sdvplot cfb shard (`teamColorsSync(..., { idSystem: "espn" })`, primary and
  secondary; INDEX_VERSION `1c025b69f8cf`), so the comparison tests the algorithm. Game on Paper reads
  ESPN's `color` / `alternateColor` at request time; the `espn` field keeps the schedule's own colours for
  reference. They match the shard for every team here except three: North Alabama (2020; ESPN `#000000`,
  sdvplot `#663399`), Merrimack (2026; ESPN `#000000` and no alternate, sdvplot `#2f4f93` / `#e8c535`) and
  Long Island University (2026; ESPN none, sdvplot `#50c9f7` / `#ffbf00`).
- Selection (69 pairs, `why`): `deep` 4 = every matchup whose pair reaches Game on Paper's last stage
  (no candidate and no readable variant separates on some theme, so both colours' L* move); `clash` 20 =
  the closest primaries by CIEDE2000; `unreadable` 10 = the primaries least readable on a background,
  among the rest; `stuck` 15 = more games where no candidate works on some theme; `random` 20 = seeded
  (mulberry32, seed 2025) from the rest.
- Every expected pair reads at WCAG 2.5:1 or better and separates by CIEDE2000 20 or more (the test checks
  it); none needed the widest-separation fallback.
- run date: 2026-10-08 (UTC)
- command (repo root): `GOP_REPO=../../game-on-paper-dev/game-on-paper-app
  CFB_SCHEDULE_DIR=../cfbfastR-dev/cfbfastR-cfb-raw/cfb/schedules/csv pnpm oracle:matchup-colors` (those
  are the defaults)
