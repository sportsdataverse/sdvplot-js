# /// script
# requires-python = ">=3.10"
# dependencies = ["polars>=1.0"]
# ///
"""Writes the real 2024 NFL fixtures the examples' STANDINGS is checked against (examples/test/sample-data.test.ts).

- fixtures/examples/nfl_games_2024_reg.csv: every 2024 regular-season game from nflverse `games.csv` (scores and each
  side's starting quarterback), rows and values as served.
- fixtures/examples/nfl_qb_espn_ids_2024.csv: the ESPN id of every quarterback who started a 2024 regular-season game,
  from nflverse `players.csv` (gsis_id -> espn_id).
- fixtures/examples/nfl_epa_2024_reg.csv: per team, the count and sum of EPA over its offensive plays and over the
  plays its defence faced, from nflverse `play_by_play_2024.parquet`: regular season, rush or pass plays
  (`pass == 1 | rush == 1`), `epa` not null. net_epa = off_epa / off_plays - def_epa / def_plays.

Run: `uv run tools/sample-data/nfl_2024.py` (downloads the three release assets), or pass local copies:
`uv run tools/sample-data/nfl_2024.py --games games.csv --pbp play_by_play_2024.parquet --players players.csv`.
"""

from __future__ import annotations

import argparse
import tempfile
import urllib.request
from pathlib import Path

import polars as pl

RELEASE = "https://github.com/nflverse/nflverse-data/releases/download"
GAMES_URL = f"{RELEASE}/schedules/games.csv"
PBP_URL = f"{RELEASE}/pbp/play_by_play_2024.parquet"
PLAYERS_URL = f"{RELEASE}/players/players.csv"
OUT = Path(__file__).resolve().parents[2] / "fixtures" / "examples"


def fetch(url: str, dest: Path) -> Path:
    urllib.request.urlretrieve(url, dest)
    return dest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--games", type=Path, help="a local nflverse games.csv (default: download it)"
    )
    ap.add_argument(
        "--pbp",
        type=Path,
        help="a local play_by_play_2024.parquet (default: download it)",
    )
    ap.add_argument(
        "--players",
        type=Path,
        help="a local nflverse players.csv (default: download it)",
    )
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        games_path = a.games or fetch(GAMES_URL, Path(tmp) / "games.csv")
        pbp_path = a.pbp or fetch(PBP_URL, Path(tmp) / "play_by_play_2024.parquet")
        players_path = a.players or fetch(PLAYERS_URL, Path(tmp) / "players.csv")
        # every column as text, so each value is written back exactly as served
        games = (
            pl.read_csv(games_path, infer_schema_length=0)
            .filter((pl.col("season") == "2024") & (pl.col("game_type") == "REG"))
            .select(
                "game_id",
                "week",
                "away_team",
                "away_score",
                "home_team",
                "home_score",
                "away_qb_id",
                "away_qb_name",
                "home_qb_id",
                "home_qb_name",
            )
        )
        assert games.height == 272, games.height
        games.write_csv(OUT / "nfl_games_2024_reg.csv", line_terminator="\n")

        starters = pl.concat([games["away_qb_id"], games["home_qb_id"]]).unique()
        qbs = (
            pl.read_csv(players_path, infer_schema_length=0)
            .select("gsis_id", "display_name", "espn_id")
            .filter(pl.col("gsis_id").is_in(starters.implode()))
            .sort("gsis_id")
        )
        assert qbs.height == starters.len(), (qbs.height, starters.len())
        qbs.write_csv(OUT / "nfl_qb_espn_ids_2024.csv", line_terminator="\n")

        plays = pl.read_parquet(
            pbp_path,
            columns=["season_type", "posteam", "defteam", "epa", "pass", "rush"],
        ).filter(
            (pl.col("season_type") == "REG")
            & pl.col("epa").is_not_null()
            & ((pl.col("pass") == 1) | (pl.col("rush") == 1))
        )
        side = lambda team, n, s: plays.group_by(pl.col(team).alias("team")).agg(  # noqa: E731
            pl.len().alias(n), pl.col("epa").sum().round(6).alias(s)
        )
        epa = (
            side("posteam", "off_plays", "off_epa")
            .join(side("defteam", "def_plays", "def_epa"), on="team")
            .sort("team")
        )
        assert epa.height == 32, epa.height
        epa.write_csv(OUT / "nfl_epa_2024_reg.csv", line_terminator="\n")


if __name__ == "__main__":
    main()
