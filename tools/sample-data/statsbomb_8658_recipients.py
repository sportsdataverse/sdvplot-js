# /// script
# requires-python = ">=3.10"
# ///
"""Writes fixtures/examples/statsbomb_8658_france_h1_pass_recipients.csv: who received each of France's 75 completed
first-half passes in the 2018 World Cup final (fixtures/examples/spadl_8658_france_h1_passes.csv), read from StatsBomb
open data, match 8658, at the open-data commit that last changed the match's events.

For each SPADL row (its action_id and original_event_id, copied from that file), the StatsBomb event with that id gives
the passer (`player.id`, which must equal the SPADL player_id) and the receiver (`pass.recipient.id`). Each player's name
is the match lineup's `player_nickname`, or its `player_name` where StatsBomb leaves the nickname null. 75 rows, in the
SPADL file's order, with the header.

Run: `uv run tools/sample-data/statsbomb_8658_recipients.py` (needs the network).
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "fixtures" / "examples"
# statsbomb/open-data: the last commit to touch data/events/8658.json and data/lineups/8658.json (2023-07-26)
SHA = "e3355d71f961dc88123d4c63655f37341c8c3957"
BASE = f"https://raw.githubusercontent.com/statsbomb/open-data/{SHA}/data"


def fetch(path: str) -> object:
    with urllib.request.urlopen(f"{BASE}/{path}") as r:  # noqa: S310 (a fixed https URL)
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    events = {e["id"]: e for e in fetch("events/8658.json")}  # type: ignore[union-attr]
    names: dict[int, str] = {}
    for team in fetch("lineups/8658.json"):  # type: ignore[union-attr]
        for p in team["lineup"]:
            names[p["player_id"]] = p["player_nickname"] or p["player_name"]
    spadl = list(
        csv.DictReader(
            (OUT / "spadl_8658_france_h1_passes.csv").open(encoding="utf-8", newline="")
        )
    )
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(
        [
            "action_id",
            "original_event_id",
            "player_id",
            "player_name",
            "recipient_id",
            "recipient_name",
        ]
    )
    for row in spadl:
        e = events[row["original_event_id"]]
        passer, recipient = e["player"]["id"], e["pass"]["recipient"]["id"]
        assert str(passer) == row["player_id"], (
            row["action_id"],
            passer,
            row["player_id"],
        )
        w.writerow(
            [
                row["action_id"],
                row["original_event_id"],
                passer,
                names[passer],
                recipient,
                names[recipient],
            ]
        )
    assert len(spadl) == 75, len(spadl)
    text = buf.getvalue()
    assert '"' not in text, (
        "a name needs quoting; the examples' csv reader splits on commas only"
    )
    (OUT / "statsbomb_8658_france_h1_pass_recipients.csv").write_text(
        text, encoding="utf-8", newline="\n"
    )


if __name__ == "__main__":
    main()
