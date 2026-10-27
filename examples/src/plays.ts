// The 11,778 rush and pass plays of weeks 1 to 6 of the 2024 NFL regular season (fixtures/examples/README.md). Its own
// module, loaded by `nflPlays2024()` in data.ts: half a megabyte of JSON stays out of the sample data every example
// page loads, and reaches only the page that shows it.
import plays from "../../fixtures/examples/nfl_plays_2024_wk1_6.json" with { type: "json" };

/** One rush or pass play, as nflverse play_by_play_2024 has it. */
export interface NflPlay2024 {
  /** `<game_id>_<play_id>`, unique: nflverse's own play key. */
  readonly play: string;
  /** nflverse's game id, `2024_<week>_<away>_<home>`. */
  readonly game_id: string;
  readonly week: number;
  readonly qtr: number;
  /** The game clock in the quarter, `m:ss`. */
  readonly clock: string;
  /** The team with the ball. */
  readonly posteam: string;
  readonly defteam: string;
  /** Null on a two-point try. */
  readonly down: number | null;
  readonly ydstogo: number;
  /** Yards from the opponent's end zone. */
  readonly yardline_100: number | null;
  readonly play_type: string;
  readonly yards_gained: number | null;
  /** Expected points added (4 decimals). */
  readonly epa: number;
  /** The offence's win probability before the play (3 decimals). */
  readonly wp: number | null;
}

const at = <T>(a: readonly T[], i: number): T => a[i] as T;
export const NFL_PLAYS_2024: readonly NflPlay2024[] = plays.game.map((g, i) => {
  const game_id = at(plays.games, g);
  const [, week, away, home] = game_id.split("_");
  const posteam = at(plays.teams, at(plays.posteam, i));
  const secs = at(plays.quarter_seconds_remaining, i) ?? 0;
  return {
    play: `${game_id}_${at(plays.play_id, i)}`,
    game_id,
    week: Number(week),
    qtr: at(plays.qtr, i) as number,
    clock: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`,
    posteam,
    defteam: (posteam === home ? away : home) as string,
    down: at(plays.down, i),
    ydstogo: at(plays.ydstogo, i) as number,
    yardline_100: at(plays.yardline_100, i),
    play_type: at(plays.play_type, i) as string,
    yards_gained: at(plays.yards_gained, i),
    epa: at(plays.epa, i),
    wp: at(plays.wp, i),
  };
});
