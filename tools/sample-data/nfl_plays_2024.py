# /// script
# requires-python = ">=3.10"
# dependencies = ["polars>=1.0"]
# ///
"""Writes fixtures/examples/nfl_plays_2024_wk1_6.json: every rush or pass play of weeks 1 to 6 of the 2024 NFL regular
season, from the nflverse release asset `pbp/play_by_play_2024.parquet` (the file nfl_epa_2024_reg.csv is built from).

The rows are the plays nfl_epa_2024_reg.csv counts (`season_type == "REG"`, `pass == 1 | rush == 1`, `epa` not null),
in the release's order. Before writing, the script rebuilds nfl_epa_2024_reg.csv from the same file and stops unless
every team's counts and sums equal the committed file, so the plays come from the release that file came from.

Columnar JSON, small enough for the docs: `games` and `teams` are lookup lists, and each play's `game` and `posteam`
index them. `epa` is rounded to 4 decimals and `wp` to 3, as written; every other value is as served.

Run: `uv run tools/sample-data/nfl_plays_2024.py` (downloads the release asset), or pass a local copy:
`uv run tools/sample-data/nfl_plays_2024.py --pbp play_by_play_2024.parquet`.
"""

from __future__ import annotations

import argparse
import json
import tempfile
import urllib.request
from pathlib import Path

import polars as pl

PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2024.parquet"
OUT = Path(__file__).resolve().parents[2] / "fixtures" / "examples"
WEEKS = 6


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--pbp",
        type=Path,
        help="a local play_by_play_2024.parquet (default: download it)",
    )
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        pbp_path = a.pbp
        if pbp_path is None:
            pbp_path = Path(tmp) / "play_by_play_2024.parquet"
            urllib.request.urlretrieve(PBP_URL, pbp_path)
        plays = pl.read_parquet(
            pbp_path,
            columns=[
                "season_type",
                "game_id",
                "play_id",
                "week",
                "qtr",
                "quarter_seconds_remaining",
                "posteam",
                "defteam",
                "down",
                "ydstogo",
                "yardline_100",
                "play_type",
                "yards_gained",
                "epa",
                "wp",
                "pass",
                "rush",
            ],
        ).filter(
            (pl.col("season_type") == "REG")
            & pl.col("epa").is_not_null()
            & ((pl.col("pass") == 1) | (pl.col("rush") == 1))
        )

    # provenance: the same plays give the committed per-team EPA file, value for value
    side = lambda team, n, s: plays.group_by(pl.col(team).alias("team")).agg(  # noqa: E731
        pl.len().alias(n), pl.col("epa").sum().round(6).alias(s)
    )
    epa = (
        side("posteam", "off_plays", "off_epa")
        .join(side("defteam", "def_plays", "def_epa"), on="team")
        .sort("team")
    )
    committed = pl.read_csv(OUT / "nfl_epa_2024_reg.csv")
    assert epa.select(committed.columns).cast(committed.schema).equals(committed), (
        "this play_by_play_2024.parquet does not rebuild nfl_epa_2024_reg.csv"
    )

    week = plays.filter(pl.col("week") <= WEEKS)
    games = week["game_id"].unique(maintain_order=True).to_list()
    teams = sorted(week["posteam"].unique().to_list())
    assert len(teams) == 32, len(teams)
    to_int = lambda c: [None if v is None else int(v) for v in week[c].to_list()]  # noqa: E731
    out = {
        "source": PBP_URL,
        "filter": f'season_type == "REG", pass == 1 | rush == 1, epa not null, week <= {WEEKS}',
        "games": games,
        "teams": teams,
        "game": [games.index(g) for g in week["game_id"].to_list()],
        "play_id": to_int("play_id"),
        "qtr": to_int("qtr"),
        "quarter_seconds_remaining": to_int("quarter_seconds_remaining"),
        "posteam": [teams.index(t) for t in week["posteam"].to_list()],
        "down": to_int("down"),
        "ydstogo": to_int("ydstogo"),
        "yardline_100": to_int("yardline_100"),
        "play_type": week["play_type"].to_list(),
        "yards_gained": to_int("yards_gained"),
        "epa": [round(v, 4) for v in week["epa"].to_list()],
        "wp": [None if v is None else round(v, 3) for v in week["wp"].to_list()],
    }
    assert len(out["game"]) >= 10_000, len(out["game"])
    (OUT / f"nfl_plays_2024_wk1_{WEEKS}.json").write_text(
        json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"{len(out['game'])} plays, {len(games)} games")


if __name__ == "__main__":
    main()
