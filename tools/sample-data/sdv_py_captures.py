# /// script
# requires-python = ">=3.10"
# ///
"""Trims captures committed in sportsdataverse-py (tests/fixtures) into fixtures/examples, where
examples/test/sample-data.test.ts checks the examples' data against them. Every kept record is copied unchanged and
only whole records (rows, plays, events) are dropped, except in the win-probability file: its plays keep three fields.

- nba_leaguestandingsv3_2023_24_pacific.json: nba_stats/leaguestandingsv3_2023_24.json, the Standings rows whose
  Division is "Pacific".
- nhl_standings_20252026_atlantic.json: nhl_api_web/standings_now.json, the standings rows whose divisionName is
  "Atlantic".
- nhl_pbp_2023030417_p1_shots.json: nhl_api_web/pbp_2024_scf_g7.json, the game header (id, season, gameType,
  gameDate, awayTeam, homeTeam) and the period-1 plays whose typeDescKey is goal, shot-on-goal or missed-shot.
- espn_nfl_summary_401671889_offense_tds.json: espn/summary_nfl.json, the competitors' homeAway and team id and
  abbreviation from the header, and the plays (from drives.previous[].plays[]) whose type is Rushing Touchdown or
  Passing Touchdown.
- espn_nfl_summary_401671889_wp.json: espn/summary_nfl.json, every winprobability entry, unchanged, and every play
  (from drives.previous[].plays[]) cut to its id, period.number and clock.displayValue: what the rows join on.
- pwhl_pbp_42_shots.json: hockeytech/pwhl_pbp_42.json, the events whose event is shot or goal.

Run: `uv run tools/sample-data/sdv_py_captures.py` (reads ../sdv-py), or `--sdv-py <path to a sportsdataverse-py
checkout>`.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "fixtures" / "examples"


def read(fx: Path, name: str) -> Any:
    return json.loads((fx / name).read_text(encoding="utf-8"))


def write(name: str, body: Any) -> None:
    text = json.dumps(body, indent=1, ensure_ascii=False) + "\n"
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sdv-py", type=Path, default=ROOT.parent / "sdv-py", help="a sportsdataverse-py checkout")
    fx = ap.parse_args().sdv_py / "tests" / "fixtures"

    nba = read(fx, "nba_stats/leaguestandingsv3_2023_24.json")
    (rs,) = nba["resultSets"]
    div = rs["headers"].index("Division")
    pacific = [r for r in rs["rowSet"] if r[div] == "Pacific"]
    assert len(pacific) == 5, len(pacific)
    write("nba_leaguestandingsv3_2023_24_pacific.json", {**nba, "resultSets": [{**rs, "rowSet": pacific}]})

    nhl = read(fx, "nhl_api_web/standings_now.json")
    atlantic = [r for r in nhl["standings"] if r["divisionName"] == "Atlantic"]
    assert len(atlantic) == 8, len(atlantic)
    write("nhl_standings_20252026_atlantic.json", {**nhl, "standings": atlantic})

    pbp = read(fx, "nhl_api_web/pbp_2024_scf_g7.json")
    shots = [
        p
        for p in pbp["plays"]
        if p["periodDescriptor"]["number"] == 1 and p["typeDescKey"] in ("goal", "shot-on-goal", "missed-shot")
    ]
    assert len(shots) == 27, len(shots)
    head = {k: pbp[k] for k in ("id", "season", "gameType", "gameDate", "awayTeam", "homeTeam")}
    write("nhl_pbp_2023030417_p1_shots.json", {**head, "plays": shots})

    summary = read(fx, "espn/summary_nfl.json")
    competitors = [
        {"homeAway": c["homeAway"], "team": {"id": c["team"]["id"], "abbreviation": c["team"]["abbreviation"]}}
        for c in summary["header"]["competitions"][0]["competitors"]
    ]
    tds = [
        p
        for d in summary["drives"]["previous"]
        for p in d["plays"]
        if p["type"]["text"] in ("Rushing Touchdown", "Passing Touchdown")
    ]
    assert len(tds) == 6, len(tds)
    write(
        "espn_nfl_summary_401671889_offense_tds.json",
        {"header": {"id": summary["header"]["id"], "competitions": [{"competitors": competitors}]}, "plays": tds},
    )

    wp = summary["winprobability"]
    assert len(wp) == 187, len(wp)
    plays = [
        {
            "id": p["id"],
            "period": {"number": p["period"]["number"]},
            "clock": {"displayValue": p["clock"]["displayValue"]},
        }
        for d in summary["drives"]["previous"]
        for p in d["plays"]
    ]
    assert len(plays) == 186, len(plays)
    write("espn_nfl_summary_401671889_wp.json", {"winprobability": wp, "plays": plays})

    pwhl = [e for e in read(fx, "hockeytech/pwhl_pbp_42.json") if e["event"] in ("shot", "goal")]
    assert len(pwhl) == 70, len(pwhl)
    write("pwhl_pbp_42_shots.json", pwhl)


if __name__ == "__main__":
    main()
