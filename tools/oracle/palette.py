"""Writes fixtures/palette/oracle.json: the shared team palette as Python's sdvplot answers it, for colorPalette.

Python's rule (perspective._palette, pydeck._end_colors): resolve each value to its team, take the team's colour
(else its other colour, else the fallback), run the palette over the distinct resolved teams, give every value its
team's colour, and give a value that does not resolve the fallback with no palette slot. Run in the sdvplot checkout,
offline (the script also makes any socket raise):

    UV_PROJECT_ENVIRONMENT=<scratch>/pyenv uv run --project ../sdvplot --extra perspective --offline --frozen \
        python tools/oracle/palette.py
"""

from __future__ import annotations

import json
import socket
import subprocess
import sys
import warnings
from pathlib import Path

# tools/oracle holds a sdvplot.py: drop this file's dir from sys.path so `import sdvplot` finds the package
sys.path[:] = [
    p for p in sys.path if Path(p or ".").resolve() != Path(__file__).resolve().parent
]


def _no_network(*_a: object, **_k: object) -> None:
    raise OSError("the palette oracle runs offline")


socket.socket.connect = _no_network  # type: ignore[method-assign]
socket.create_connection = _no_network  # type: ignore[assignment]

import polars as pl  # noqa: E402
import sdvplot  # noqa: E402
from sdvplot import _index  # noqa: E402
from sdvplot._resolve import resolve  # noqa: E402
from sdvplot.perspective import _palette  # noqa: E402
from sdvplot.pydeck import _end_colors  # noqa: E402

warnings.simplefilter("ignore")
OUT = Path(__file__).resolve().parents[2] / "fixtures" / "palette" / "oracle.json"
NFL = "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LA LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WSH".split()


def ids(league: str) -> list[str]:
    """Every team of a league, by team_id, in the index's order."""
    return _index.team_table().filter(pl.col("league") == league)["team_id"].to_list()


# (league, values, season, id_system, background): perspective._palette, the primary colour
primary: list[tuple[str, list, int | None, str, str]] = []
for bg in ("#ffffff", "#181a1b", "#000000", "#242526"):
    primary.append(("nfl", NFL, None, "auto", bg))
for lg in ("nba", "mlb", "nhl"):
    for bg in ("#ffffff", "#181a1b"):
        primary.append((lg, ids(lg), None, "auto", bg))
for bg in ("#ffffff", "#181a1b"):
    primary.append(
        ("nfl", ["KC", 12, "Kansas City Chiefs", "BUF"], None, "auto", bg)
    )  # aliases of one team
    primary.append(
        ("nfl", ["KC", "KC", "BUF", "KC"], None, "auto", bg)
    )  # a value repeated
primary.append(("nfl", ["LA", "Los Angeles Rams", "SF"], None, "auto", "#ffffff"))
primary.append(
    ("nfl", ["BAL", "BUF", "DET", "USFL", "XFL"], None, "auto", "#ffffff")
)  # unresolved, two greys
for bg in ("#ffffff", "#181a1b", "#000000"):
    primary.append(
        ("nfl", ["XFL", *NFL, "USFL"], None, "auto", bg)
    )  # unresolved around every team
primary.append(
    ("nfl", ["OAK", "LV", "KC", "SD", "LAC", "STL", "LA"], 2015, "auto", "#ffffff")
)  # a season
primary.append(
    ("nfl", ["OAK", "LV", "KC", "SD", "LAC", "STL", "LA"], 2024, "auto", "#181a1b")
)
primary.append(
    ("nfl", [12, "12", 2, 33, 99999], None, "espn", "#181a1b")
)  # an id system
primary.append(
    (
        "nba",
        [1610612747, "LAL", "Los Angeles Lakers", 1610612738, "BOS"],
        None,
        "auto",
        "#ffffff",
    )
)
primary.append(
    ("cfb", ids("cfb")[:60], None, "auto", "#ffffff")
)  # a crowded college palette
primary.append(("cfb", ids("cfb")[:60], None, "auto", "#181a1b"))

# (league, values, season, which, background): pydeck._end_colors over distinct values (each team once), `which`
# and no background too
ends: list[tuple[str, list, int | None, str, str | None]] = []
for which in ("primary", "secondary"):
    for bg in (None, "#ffffff", "#181a1b"):
        ends.append(("nfl", [*NFL, "XFL"], None, which, bg))
        ends.append(
            (
                "cfb",
                ["Towson Tigers", "Ithaca Bombers", "Alabama Crimson Tide", "ZZZ"],
                None,
                which,
                bg,
            )
        )


def run_primary(
    lg: str, values: list, season: int | None, id_system: str, bg: str
) -> list[str]:
    return _palette(
        values,
        league=lg,
        season=season,
        background=bg,
        id_system=id_system,
        strict=False,
    )


def run_ends(
    lg: str, values: list, season: int | None, which: str, bg: str | None
) -> list[str]:
    got = resolve(values, lg, season=season, strict=False)
    assert len({g for g in got if g is not None}) == len(
        [g for g in got if g is not None]
    ), "distinct teams only"
    return _end_colors(
        got, league=lg, season=season, which=which, background=bg, fallback="#808080"
    )


cases = [
    {"league": lg, "values": v, "season": s, "idSystem": i, "which": "primary", "background": bg,
     "colors": run_primary(lg, v, s, i, bg)}
    for lg, v, s, i, bg in primary
] + [
    {"league": lg, "values": v, "season": s, "idSystem": "auto", "which": w, "background": bg,
     "colors": run_ends(lg, v, s, w, bg)}
    for lg, v, s, w, bg in ends
]  # fmt: skip
repo = Path(sdvplot.__file__).resolve().parents[2]
commit = subprocess.run(
    ["git", "-C", str(repo), "rev-parse", "--short=8", "HEAD"],
    capture_output=True,
    text=True,
)
meta = {
    "sdvplot_version": sdvplot.__version__,
    "sdvplot_commit": commit.stdout.strip(),
    "index_version": _index.index_version(),
    "fallback": "#808080",
}
OUT.parent.mkdir(parents=True, exist_ok=True)
text = json.dumps({"meta": meta, "cases": cases}, indent=1, ensure_ascii=False) + "\n"
OUT.write_text(
    text, encoding="utf-8", newline="\n"
)  # LF on Windows too: the repo checks the file out as LF
print(
    f"wrote {OUT}: {len(cases)} cases; sdvplot {meta['sdvplot_version']} {meta['sdvplot_commit']}"
)
