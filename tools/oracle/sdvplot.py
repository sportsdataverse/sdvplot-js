"""Writes fixtures/sdvplot/*.json: real inputs sampled from sdvplot's own index + the Python package's answers."""
from __future__ import annotations
import json, random, sys, warnings
from pathlib import Path

# this file is named sdvplot.py: drop its own dir from sys.path so `import sdvplot` finds the package
sys.path[:] = [p for p in sys.path if Path(p or ".").resolve() != Path(__file__).resolve().parent]
import polars as pl
import sdvplot
from sdvplot import _index
from sdvplot._manifest import load_manifest

OUT = Path(__file__).resolve().parents[2] / "fixtures" / "sdvplot"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(20261005)
warnings.simplefilter("ignore")

aliases = _index.alias_table().filter(pl.col("id_system") != "mark")
inputs: list[dict] = []
for league in sorted(_index.team_table()["league"].unique()):
    a = aliases.filter(pl.col("league") == league)
    for system in a["id_system"].unique().sort():
        rows = a.filter(pl.col("id_system") == system).sample(n=min(40, a.filter(pl.col("id_system") == system).height), seed=1)
        for r in rows.iter_rows(named=True):
            inputs.append({"league": league, "value": r["value"], "season": None, "id_system": "auto"})
            inputs.append({"league": league, "value": r["value"], "season": None, "id_system": system})
            if r["valid_from"] is not None: inputs.append({"league": league, "value": r["value"], "season": int(r["valid_from"]), "id_system": "auto"})
            if r["valid_to"] is not None:  inputs.append({"league": league, "value": r["value"], "season": int(r["valid_to"]) + 1, "id_system": "auto"})
# edge cases: float-origin ids, whitespace, case, relocations, ambiguous codes
for league, value in [("nfl", "OAK"), ("nfl", "SD"), ("nfl", "STL"), ("nba", "SEA"), ("nba", "NJN"), ("mlb", "KCA"), ("mlb", "MON"), ("nhl", "QUE"), ("nhl", "ATL"), ("nhl", "HFD"), ("wnba", "DET"), ("cfb", "Miami"), ("mbb", "Miami")]:
    for season in (None, 1995, 2005, 2015, 2025): inputs.append({"league": league, "value": value, "season": season, "id_system": "auto"})
for league, value in [("nfl", "12.0"), ("nfl", " kc "), ("nfl", "Kansas City Chiefs"), ("nba", 1610612747), ("nba", "1610612747.0"), ("mbb", "San José State"), ("cfb", "Texas A&M"), ("nhl", 1), ("nhl", "1")]:
    inputs.append({"league": league, "value": value, "season": None, "id_system": "auto"})
    if league == "nhl": inputs.append({"league": league, "value": value, "season": None, "id_system": "nhl_id"})

def run(fn):
    out = []
    for i in inputs:
        try: out.append(fn(i))
        except Exception as e: out.append({"error": type(e).__name__})
    return out

res = run(lambda i: {"team_id": sdvplot.resolve(i["value"], i["league"], season=i["season"], id_system=i["id_system"])})
pal = run(lambda i: {"primary": sdvplot.team_colors(i["league"], i["value"], season=i["season"], id_system=i["id_system"]), "secondary": sdvplot.team_colors(i["league"], i["value"], which="secondary", season=i["season"], id_system=i["id_system"])})
logos = run(lambda i: {v: sdvplot.logo_url(i["value"], i["league"], season=i["season"], variant=v, id_system=i["id_system"]) for v in ("default", "dark")} | {"wordmark": sdvplot.logo_url(i["value"], i["league"], season=i["season"], mark_type="wordmark", id_system=i["id_system"])})
heads = [{"player_id": p, "league": lg, "id_system": s, "url": sdvplot.headshot_url(p, lg, id_system=s)} for p, lg, s in [("3139477", "nfl", "espn"), ("00-0033873", "nfl", "gsis"), ("00-0036355", "nfl", "gsis"), (2544, "nba", "espn"), ("x", "nba", "espn"), ("4433403", "cfb", "espn"), ("4433403.0", "mbb", "espn")]]
meta = {"sdvplot_version": sdvplot.__version__, "index_version": _index.index_version(), "manifest_rows": load_manifest().height, "n_inputs": len(inputs)}
for name, obj in [("inputs", inputs), ("resolve", res), ("palette", pal), ("logo_url", logos), ("headshot_url", heads), ("meta", meta)]:
    (OUT / f"{name}.json").write_text(json.dumps(obj, indent=0, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {len(inputs)} inputs; index {meta['index_version']}")
