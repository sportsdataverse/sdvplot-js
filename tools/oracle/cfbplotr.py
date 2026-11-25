"""Writes fixtures/sdvplot/cfbplotr.json: sdvplot's (Python) answers for the cfbplotR-era functions (teams(division=),
aliases(), clean_names(), team_factor(), alt_colors, add_athlete_id()) on the inputs sdvplot's own parity tests hold to
sdvplotR (its tests/fixtures/sdvplotr_*.csv), so the TypeScript port is held to Python and, through it, to R.

  SDVPLOT_PY_REPO=../sdvplot pnpm oracle:cfbplotr
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import warnings
from pathlib import Path

import pandas as pd
import polars as pl
import requests

import sdvplot
from sdvplot import _headshots, _index

PY_REPO = Path(os.environ.get("SDVPLOT_PY_REPO", "../sdvplot")).resolve()
R_FIX = PY_REPO / "tests" / "fixtures"
OUT = Path(__file__).resolve().parents[2] / "fixtures" / "sdvplot" / "cfbplotr.json"
warnings.simplefilter("ignore")


def csv(name: str) -> pl.DataFrame:
    return pl.read_csv(R_FIX / name, infer_schema=False)


meta = csv("sdvplotr_cfbplotr_meta.csv").row(0, named=True)
if meta["index_version"] != _index.index_version():
    sys.exit(
        f"sdvplot bundles index {_index.index_version()}, its R fixtures answer for {meta['index_version']}"
    )


def attempt(fn):
    try:
        return fn()
    except Exception as e:  # the error class name is the answer
        return {"error": type(e).__name__}


divisions = []
for (league, division), _ in csv("sdvplotr_divisions.csv").group_by(
    "league", "division", maintain_order=True
):
    asked = division.split("+")
    got = attempt(
        lambda: sorted(sdvplot.teams(league, division=asked)["team_id"].to_list())
    )
    divisions.append({"league": league, "division": asked, "team_ids": got})

aliases = []
for league in sorted(_index.alias_table()["league"].unique().to_list()):
    x = sdvplot.aliases(league)
    lines = sorted(
        "\t".join("" if v is None else str(v) for v in r) for r in x.iter_rows()
    )
    aliases.append(
        {
            "league": league,
            "rows": x.height,
            "md5": hashlib.md5("\n".join(lines).encode()).hexdigest(),
        }
    )

clean = []
cn = csv("sdvplotr_clean_names.csv")
for (league, numeric, column), rows in cn.group_by(
    "league", "numeric", "column", maintain_order=True
):
    values = rows["value"].to_list()
    if numeric == "TRUE":
        values = [None if v is None else float(v) for v in values]
    clean.append(
        {
            "league": league,
            "column": column,
            "values": values,
            "keep": sdvplot.clean_names(values, league, column=column),
            "drop": sdvplot.clean_names(
                values, league, column=column, keep_non_matches=False
            ),
        }
    )

factors = []
tf = csv("sdvplotr_team_factor.csv")
for (_, league), rows in tf.group_by("case", "league", maintain_order=True):
    part = {
        k: rows.filter(pl.col("kind") == k)["value"].to_list()
        for k in ("input", "number")
    }
    values = part["input"] or [float(v) for v in part["number"]]
    f = sdvplot.team_factor(values, league)
    factors.append(
        {
            "league": league,
            "values": values,
            "factor": f.to_list(),
            "levels": f.dtype.categories.to_list(),
        }
    )

alt = []
ac = csv("sdvplotr_alt_colors.csv")
for (league, which, alts), rows in ac.group_by(
    "league", "which", "alt_colors", maintain_order=True
):
    values, alt_colors = rows["value"].to_list(), alts.split("|")
    alt.append(
        {
            "league": league,
            "which": which,
            "alt_colors": alt_colors,
            "values": values,
            "colors": sdvplot.team_colors(league, values, which=which),
            "swapped": sdvplot.team_colors(
                league, values, which=which, alt_colors=alt_colors
            ),
            "palette": sdvplot.palette(
                league, values, which=which, alt_colors=alt_colors
            ),
            "palette_whole": sdvplot.palette(
                league, which=which, alt_colors=alt_colors
            ),
        }
    )

# add_athlete_id on the roster rows sdvplotR read (the files' own columns), at sdvplotR's latest season
rosters = csv("sdvplotr_athlete_rosters.csv")
players = csv("sdvplotr_athlete_ids.csv")
latest = int(players["latest_season"][0])
by_season = {
    int(s): r.drop("season")
    for (s,), r in rosters.group_by("season", maintain_order=True)
}
tmp = OUT.parent / ".cfbplotr_rosters"
tmp.mkdir(exist_ok=True)
paths = {}
for s, r in by_season.items():
    paths[s] = tmp / f"{s}.parquet"
    r.write_parquet(paths[s])
_headshots._roster = lambda league, s: (
    _headshots._roster_rows(str(paths[s]), 0.0, s) if s in paths else ()
)
_headshots._latest_roster_season = lambda: latest
x = players.select("player_name", "team", pl.col("season").cast(pl.Int64))
athletes = {
    "latest_season": latest,
    "rosters": {str(s): r.to_dicts() for s, r in by_season.items()},
    "players": x.to_dicts(),
    "with_team": sdvplot.add_athlete_id(x, "player_name", headshot_urls=True)
    .select("athlete_id", "headshot_url")
    .to_dicts(),
    "name_only": sdvplot.add_athlete_id(x.select("player_name"), "player_name")[
        "athlete_id"
    ].to_list(),
    "name_season": sdvplot.add_athlete_id(
        x.select("player_name", "season"), "player_name"
    )["athlete_id"].to_list(),
}

# the parsing branches: seasons as text, fractions, missing and out of range; teams as ESPN ids (numbers and text)
mixed = pd.DataFrame(
    {
        "player_name": [
            "Britain Covey",
            "JT Daniels",
            "Bryce Young",
            "Bo Nix",
            "Josh Allen",
            "Caleb Williams",
        ],
        "team": ["Utah", 61, "333", "Oregon", "Wyoming", "USC"],
        "season": ["2021", 2021.7, None, "2005", "2030", " 2023 "],
    },
    dtype=object,
)


def ids(frame: pd.DataFrame) -> list:
    return [
        None if pd.isna(v) else v
        for v in sdvplot.add_athlete_id(frame, "player_name")["athlete_id"]
    ]


athletes["mixed"] = {"players": mixed.to_dict("records"), "athlete_id": ids(mixed)}
stale = mixed.assign(
    season=["1999"] * len(mixed)
)  # no season with rosters: the latest season's
athletes["out_of_range"] = {
    "players": stale.to_dict("records"),
    "athlete_id": ids(stale),
}
for p in paths.values():
    p.unlink()

# real CSV lines (the file addAthleteId downloads) and what Python reads from the same rows of the parquet file: the
# rows with an empty name part, and the first few
base = "https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main/rosters"
text = requests.get(f"{base}/csv/cfb_rosters_2009.csv", timeout=120).text
pq = pl.read_parquet(
    io.BytesIO(
        requests.get(f"{base}/parquet/cfb_rosters_2009.parquet", timeout=120).content
    )
)
odd = pq.filter((pl.col("first_name") == "") | (pl.col("last_name") == ""))[
    "athlete_id"
].to_list()
keep = set(odd) | set(pq["athlete_id"].head(4).to_list())
lines = text.splitlines()
csv_lines = [lines[0], *[ln for ln in lines[1:] if ln.split(",", 1)[0] in keep]]
part = tmp / "2009.parquet"
pq.filter(pl.col("athlete_id").is_in(sorted(keep))).write_parquet(part)
athletes["csv_2009"] = {
    "text": "\n".join(csv_lines) + "\n",
    "rows": [list(r) for r in _headshots._roster_rows(str(part), 0.0, 2009)],
    "empty_name_ids": odd,
}
part.unlink()
tmp.rmdir()
# Python agrees with R on these (sdvplot's tests/test_cfbplotr_parity.py); check again so a stale sdvplot fails here
assert [r["athlete_id"] for r in athletes["with_team"]] == players[
    "athlete_id"
].to_list()

out = {
    "meta": {
        "sdvplot_version": sdvplot.__version__,
        "index_version": _index.index_version(),
        **meta,
    },
    "divisions": divisions,
    "aliases": aliases,
    "clean_names": clean,
    "team_factor": factors,
    "alt_colors": alt,
    "add_athlete_id": athletes,
}
OUT.write_text(json.dumps(out, indent=0, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {OUT.name}: index {_index.index_version()}")
