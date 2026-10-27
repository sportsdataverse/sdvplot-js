# /// script
# requires-python = ">=3.10"
# dependencies = ["polars>=1.0"]
# ///
"""Writes the NFL venue fixtures the MapLibre examples draw (examples/test/sample-data.test.ts checks them).

- fixtures/examples/nfl_stadiums_2024.csv: each team's 2024 home stadium and its coordinates. The stadium is the
  `stadium_id` of most of the team's 2024 regular-season home games in nflverse `games.csv` (a joined id, never a
  name), and its row comes from nfl-data `nfl/stadiums/stadiums.csv`: a verbatim copy of greerreNFL/Stadiums
  `data/stadiums.csv` (nfelo) at upstream commit 3e97318781f198973e1414189d6324249657f562, whose sha256 is asserted.
- fixtures/examples/nfl_airports.csv: nflverse nfldata `data/airports.csv` (each team's home airport), every row,
  columns `team`, `airport`, `latitude`, `longitude` as served.

Local files only, nothing is downloaded:
`uv run tools/sample-data/nfl_venues.py --stadiums <nfl-data>/nfl/stadiums/stadiums.csv
--games <nfldata>/data/games.csv --airports <nfldata>/data/airports.csv`.
The 2024 regular-season games of `--games` must equal the committed fixtures/examples/nfl_games_2024_reg.csv.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import polars as pl

STADIUMS_SHA256 = "c73bc82fdcb5abe9018227a61bfe91a562d7bf1f10214ee34f1a480d5bcd519c"
OUT = Path(__file__).resolve().parents[2] / "fixtures" / "examples"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--stadiums",
        type=Path,
        required=True,
        help="nfl-data nfl/stadiums/stadiums.csv",
    )
    ap.add_argument(
        "--games",
        type=Path,
        required=True,
        help="an nflverse games.csv (nfldata data/games.csv)",
    )
    ap.add_argument(
        "--airports", type=Path, required=True, help="nfldata data/airports.csv"
    )
    a = ap.parse_args()

    sha = hashlib.sha256(a.stadiums.read_bytes()).hexdigest()
    assert sha == STADIUMS_SHA256, (
        f"stadiums.csv sha256 {sha}, expected {STADIUMS_SHA256}"
    )

    # every column as text, so ids and coordinates are written back exactly as served
    games = pl.read_csv(a.games, infer_schema=False).filter(
        (pl.col("season") == "2024") & (pl.col("game_type") == "REG")
    )
    fixture = pl.read_csv(OUT / "nfl_games_2024_reg.csv", infer_schema=False)
    same = games.select(fixture.columns).sort("game_id")
    assert same.equals(fixture.sort("game_id")), (
        "--games' 2024 regular season differs from nfl_games_2024_reg.csv"
    )

    stadiums = pl.read_csv(a.stadiums, infer_schema=False)
    assert stadiums["stadium_id"].n_unique() == stadiums.height, (
        "stadium_id is not unique"
    )
    missing = set(games["stadium_id"]) - set(stadiums["stadium_id"])
    assert not missing, f"2024 games at stadiums not in stadiums.csv: {missing}"

    # each team's home stadium: where most of its 2024 home games were (a neutral-site game is the odd one out)
    home = (
        games.group_by("home_team", "stadium_id")
        .agg(pl.len().alias("games"))
        .sort(["home_team", "games", "stadium_id"], descending=[False, True, False])
        .group_by("home_team", maintain_order=True)
        .first()
        .rename({"home_team": "team"})
    )
    assert home.height == 32, f"{home.height} home teams"
    out = (
        home.join(stadiums, on="stadium_id", how="left", validate="m:1")
        .select("team", "stadium_id", "stadium_name", "lat", "lon")
        .sort("team")
    )
    assert out["lat"].null_count() == 0 and out["lon"].null_count() == 0
    out.write_csv(OUT / "nfl_stadiums_2024.csv")

    airports = pl.read_csv(a.airports, infer_schema=False).select(
        "team", "airport", "latitude", "longitude"
    )
    assert set(airports["team"]) == set(out["team"]), (
        "airports.csv's teams are not the 2024 teams"
    )
    airports.sort("team").write_csv(OUT / "nfl_airports.csv")
    print(out)
    print(airports.height, "airports")


if __name__ == "__main__":
    main()
