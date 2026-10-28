"""Writes fixtures/perspective/oracle.json: sdvplot's (Python) perspective_sdv_config on real frames, for the parity test
of sdvplot-js's ./perspective (packages/sdvplot/test/perspective-parity.test.ts), and table_theme_spec on a few registry
themes, for sdvtables' tableThemeSpec (packages/sdvtables/test/table-theme-spec.test.ts, which also runs the theme
cases with the spec sdvtables resolves), and perspective_logo_column on real frames, for perspectiveLogoColumn (the
same parity test).

Run from this repo with the Python package's checkout beside it, in an environment of its own built offline from uv's
cache (the parity point is perspective-python 5.5.1, the floor of both packages):

    UV_PROJECT_ENVIRONMENT=<scratch>/pyenv uv run --project ../sdvplot --extra perspective --offline --frozen \
        python tools/oracle/perspective.py

with SDVPLOT_CACHE_DIR set to a scratch copy of a cache holding the logo manifest (`manifest/marks.csv` and its
`.meta.json`; never the user's own cache) and SDVPLOT_CACHE_TTL large enough that the copy counts as fresh.

It reads only committed fixtures of this repo, sdvplot's shipped index and that cached manifest, and refuses the
network: any socket it opens raises (so a manifest refresh fails the run instead of downloading). Never hand-edit the output; a parity failure is a port bug (or a finding to report).
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import socket
import subprocess
import sys
import warnings
from pathlib import Path

# this file sits beside sdvplot.py: drop its own dir from sys.path so `import sdvplot` finds the package
sys.path[:] = [
    p for p in sys.path if Path(p or ".").resolve() != Path(__file__).resolve().parent
]


def _no_network(*_a, **_k):
    raise RuntimeError("tools/oracle/perspective.py must not use the network")


socket.socket.connect = _no_network  # type: ignore[method-assign]
socket.create_connection = _no_network  # type: ignore[assignment]

import perspective  # noqa: E402
import polars as pl  # noqa: E402
import sdvplot  # noqa: E402
from sdvplot import _cache, _index  # noqa: E402
from sdvplot import table_theme_spec  # noqa: E402
from sdvplot.perspective import perspective_logo_column, perspective_sdv_config  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
EX = ROOT / "fixtures" / "examples"
OUT = ROOT / "fixtures" / "perspective"

# The 2024 NFL regular season by offence (nflverse play-by-play, fixtures/examples/nfl_epa_2024_reg.csv): plays, EPA per
# play on offence and allowed on defence, in the order of the best offence first (the grid's first-appearance order).
epa = (
    pl.read_csv(EX / "nfl_epa_2024_reg.csv")
    .select(
        pl.col("team"),
        pl.col("off_plays").alias("plays"),
        (pl.col("off_epa") / pl.col("off_plays")).alias("epa_per_play"),
        (pl.col("def_epa") / pl.col("def_plays")).alias("def_epa_per_play"),
    )
    .sort("epa_per_play", descending=True)
)
# The 2023-24 NBA Pacific Division (stats.nba.com leaguestandingsv3, fixtures/examples/...pacific.json): numeric
# stats.nba.com team ids, wins and the win percentage (a float named pct: one decimal)
nba_json = json.loads(
    (EX / "nba_leaguestandingsv3_2023_24_pacific.json").read_text(encoding="utf-8")
)
rs = nba_json["resultSets"][0]
nba = (
    pl.DataFrame([dict(zip(rs["headers"], r, strict=True)) for r in rs["rowSet"]])
    .select(
        pl.col("TeamID").alias("team_id"),
        pl.col("WINS").alias("wins"),
        pl.col("WinPCT").alias("win_pct"),
    )
    .with_columns(pl.col("win_pct") * 100)
)
# the four best offences, Baltimore's team value missing: a null team
nulls = epa.head(4).with_columns(
    pl.when(pl.col("team") == "BAL").then(None).otherwise(pl.col("team")).alias("team")
)
# the best three offences and two values that name no NFL team
unresolved = pl.concat(
    [epa.head(3), pl.DataFrame({"team": ["XFL", "USFL"], "plays": [1, 2]})],
    how="diagonal_relaxed",
)
# Python's test_split_order_is_codepoint_order_as_perspective_sorts frame: upper case sorts first
cfb = pl.DataFrame(
    {
        "team": ["Utah", "Louisiana", "Texas", "LSU", "UCF", "TCU"],
        "wins": [5, 10, 13, 9, 4, 9],
    }
)
# a logo URL column with no URLs: these config cases only show the column as links (LOGO_CASES below fill one)
logos = epa.head(3).with_columns(pl.lit(None, dtype=pl.String).alias("team_logo"))

TWO = {"minimumFractionDigits": 2, "maximumFractionDigits": 2}
CASES: list[tuple[str, pl.DataFrame, dict]] = [
    ("datagrid light", epa, {"team_col": "team", "league": "nfl"}),
    ("datagrid dark", epa, {"team_col": "team", "league": "nfl", "mode": "dark"}),
    ("y bar light", epa, {"team_col": "team", "league": "nfl", "plugin": "Y Bar"}),
    (
        "y bar dark",
        epa,
        {"team_col": "team", "league": "nfl", "plugin": "Y Bar", "mode": "dark"},
    ),
    (
        "y line dark",
        epa,
        {"team_col": "team", "league": "nfl", "plugin": "Y Line", "mode": "dark"},
    ),
    (
        "scatter light",
        epa,
        {"team_col": "team", "league": "nfl", "plugin": "X/Y Scatter"},
    ),
    (
        "scatter dark",
        epa,
        {"team_col": "team", "league": "nfl", "plugin": "X/Y Scatter", "mode": "dark"},
    ),
    ("datagrid numeric team ids", nba, {"team_col": "team_id", "league": "nba"}),
    (
        "y bar numeric team ids",
        nba,
        {"team_col": "team_id", "league": "nba", "plugin": "Y Bar"},
    ),
    ("datagrid null team", nulls, {"team_col": "team", "league": "nfl"}),
    (
        "y bar null team",
        nulls,
        {"team_col": "team", "league": "nfl", "plugin": "Y Bar"},
    ),
    (
        "scatter null team dark",
        nulls,
        {"team_col": "team", "league": "nfl", "plugin": "X/Y Scatter", "mode": "dark"},
    ),
    ("datagrid unresolved", unresolved, {"team_col": "team", "league": "nfl"}),
    (
        "y bar unresolved",
        unresolved,
        {"team_col": "team", "league": "nfl", "plugin": "Y Bar"},
    ),
    (
        "y bar codepoint order",
        cfb,
        {"team_col": "team", "league": "cfb", "plugin": "Y Bar"},
    ),
    (
        "datagrid formats and background",
        epa,
        {
            "team_col": "team",
            "league": "nfl",
            "background": "#14171c",
            "formats": {"epa_per_play": TWO, "plays": None},
        },
    ),
    (
        "datagrid logo link",
        logos,
        {"team_col": "team", "league": "nfl", "logo_col": "team_logo"},
    ),
    (
        "y bar logo column",
        logos,
        {
            "team_col": "team",
            "league": "nfl",
            "logo_col": "team_logo",
            "plugin": "Y Bar",
        },
    ),
    ("datagrid season", epa, {"team_col": "team", "league": "nfl", "season": 2024}),
    # no rows: Python keeps the frame's columns (number formats, no palette); rows of objects carry none without a schema
    ("datagrid no rows", epa.head(0), {"team_col": "team", "league": "nfl"}),
    ("y bar no rows", epa.head(0), {"team_col": "team", "league": "nfl", "plugin": "Y Bar"}),
    # a registry theme: the grid's font (plugin_config) and each number column's sign colours; datagolf's numeric face
    # is its body face (no per-column font), nfl-next-gen-stats's is not (Roboto Mono); every registry theme has a body
    # face, so the no-body-font branch has no registry case. A chart takes none of it.
    ("datagrid theme light", epa, {"team_col": "team", "league": "nfl", "theme": "datagolf"}),
    ("datagrid theme dark", epa, {"team_col": "team", "league": "nfl", "theme": "datagolf", "mode": "dark"}),
    (
        "datagrid theme numeric font",
        epa,
        {"team_col": "team", "league": "nfl", "theme": "nfl-next-gen-stats"},
    ),
    (
        "datagrid theme numeric font dark",
        epa,
        {"team_col": "team", "league": "nfl", "theme": "nfl-next-gen-stats", "mode": "dark"},
    ),
    ("y bar theme", epa, {"team_col": "team", "league": "nfl", "plugin": "Y Bar", "theme": "datagolf"}),
    (
        "datagrid theme numeric team ids",
        nba,
        {"team_col": "team_id", "league": "nba", "theme": "datagolf"},
    ),
    (
        "datagrid theme logo link and no format",
        logos,
        {
            "team_col": "team",
            "league": "nfl",
            "theme": "ft-markets-data",
            "logo_col": "team_logo",
            "formats": {"plays": None},
        },
    ),
]
# table_theme_spec, every field: native and derived dark modes, numeric faces of their own, a light-only theme, a
# journal, striped themes with nested structure (heatColumns)
SPECS = [
    ("datagolf", "light"),
    ("datagolf", "dark"),
    ("nfl-next-gen-stats", "light"),
    ("nfl-next-gen-stats", "dark"),
    ("barrons-markets", "dark"),
    ("ft-markets-data", "light"),
    ("nejm", "light"),
    ("dunks-and-threes", "dark"),
    ("evanmiya", "light"),
]

# perspective_logo_column, from the cached logo manifest: the NFL frame (string codes), the NBA one (numeric
# stats.nba.com ids), unresolved and null teams, the "dark" variant, a custom name, and a season for every team on the
# codes of relocated franchises (Oakland/Las Vegas Raiders, San Diego/Los Angeles Chargers, St. Louis/Los Angeles Rams)
reloc = pl.DataFrame({"team": ["OAK", "LV", "SD", "LAC", "STL", "LA"]})
# NCAA women's hockey: Minnesota, Delaware (in the index, with no archived logo: the other warning), an unknown code
whockey = pl.DataFrame({"team": ["MINN", "DEL", "ZZZ", "DEL"]})
LOGO_CASES: list[tuple[str, pl.DataFrame, str, dict]] = [
    ("nfl teams", epa, "team", {"league": "nfl"}),
    ("numeric team ids", nba, "team_id", {"league": "nba"}),
    ("unresolved", unresolved, "team", {"league": "nfl"}),
    ("null team", nulls, "team", {"league": "nfl"}),
    ("variant dark", epa, "team", {"league": "nfl", "variant": "dark"}),
    ("custom name", epa.head(3), "team", {"league": "nfl", "name": "logo"}),
    ("relocations season 2015", reloc, "team", {"league": "nfl", "season": 2015}),
    ("relocations season 2024", reloc, "team", {"league": "nfl", "season": 2024}),
    ("no archived logo", whockey, "team", {"league": "ncaa_whockey", "variant": "dark"}),
]


def spec_dict(name: str, mode: str) -> dict:
    """table_theme_spec as JSON: the dataclass's fields in order."""
    return dataclasses.asdict(table_theme_spec(name, mode))  # type: ignore[arg-type]


def ptype(dtype: pl.DataType) -> str:
    """The Perspective type the frame's column loads as."""
    if dtype.is_integer():
        return "integer"
    if dtype.is_float():
        return "float"
    if dtype == pl.Boolean:
        return "boolean"
    return "string"


cases = []
for name, frame, kw in CASES:
    with warnings.catch_warnings(record=True) as rec:
        warnings.simplefilter("always")
        config = perspective_sdv_config(frame, **kw)
    case = {
        "name": name,
        "options": kw,
        "schema": {c: ptype(d) for c, d in frame.schema.items()},
        "rows": frame.to_dicts(),
        "config": config,
        "warnings": [str(w.message) for w in rec],
    }
    if "theme" in kw:  # the spec the config read, for a parity test that cannot resolve a theme itself
        case["theme_spec"] = spec_dict(kw["theme"], kw.get("mode", "light"))
    cases.append(case)
specs = [{"name": n, "mode": m, "spec": spec_dict(n, m)} for n, m in SPECS]
logo_columns = []
for name, frame, team_col, kw in LOGO_CASES:
    with warnings.catch_warnings(record=True) as rec:
        warnings.simplefilter("always")
        out = perspective_logo_column(frame, team_col, **kw)
    logo_columns.append(
        {
            "name": name,
            "team_col": team_col,
            "options": kw,
            "rows": frame.to_dicts(),
            "result": out.to_dicts(),
            "warnings": [str(w.message) for w in rec],
        }
    )
manifest = _cache.read_meta("manifest/marks.csv") or {}

PY = ROOT.parent / "sdvplot"
git = lambda *a: subprocess.run(
    ["git", "-C", str(PY), *a], capture_output=True, text=True, check=True
).stdout.strip()  # noqa: E731
meta = {
    "sdvplot_commit": git("rev-parse", "HEAD"),
    "perspective_py_commit": git(
        "log", "-1", "--format=%H", "--", "src/sdvplot/perspective.py"
    ),
    "sdvplot_version": sdvplot.__version__,
    "table_themes_py_commit": git(
        "log", "-1", "--format=%H", "--", "src/sdvplot/_table_themes.py"
    ),
    "table_themes_json_commit": git(
        "log", "-1", "--format=%H", "--", "src/sdvplot/data/table_themes.json"
    ),
    "perspective_python": perspective.__version__,
    "index_version": _index.index_version(),
    "manifest_etag": manifest.get("etag"),
    "manifest_last_modified": manifest.get("last_modified"),
    "manifest_sha256": hashlib.sha256(_cache.cache_path("manifest/marks.csv").read_bytes()).hexdigest(),
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "oracle.json").write_text(
    json.dumps({"meta": meta, "cases": cases, "table_theme_specs": specs, "logo_columns": logo_columns}, indent=1, ensure_ascii=False) + "\n",
    encoding="utf-8",
    newline="\n",  # LF on every platform: the parity test pins these bytes
)
print(
    f"wrote {len(cases)} cases, {len(specs)} specs and {len(logo_columns)} logo columns; sdvplot {meta['sdvplot_commit'][:8]}, index {meta['index_version']}"
)
