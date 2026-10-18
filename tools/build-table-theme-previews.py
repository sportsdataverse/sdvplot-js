"""Convert the table-design-survey preview PNGs to WebP for the theme gallery.

Usage: python -I tools/build-table-theme-previews.py <survey previews dir> [--out docs/static/img/table-themes]

Reads packages/sdvtables/data/table_themes.json: one `<id>-light.webp` per registry id, plus `<id>-dark.webp` when
the entry's darkPolicy is not "none". Survey ids map to registry ids 1:1 except the three renamed sources; survey
ids absent from the registry (reactablefmtr-*, kenpom, ncaa) are skipped. Needs Pillow.
"""

import json
import sys
from pathlib import Path

from PIL import Image

RENAMED = {"espn-site": "espn", "fivethirtyeight-site": "fivethirtyeight", "pff-site": "pff"}  # registry -> survey
QUALITY = 80

root = Path(__file__).resolve().parent.parent
args = sys.argv[1:]
if not args or args[0].startswith("--"):
    sys.exit(__doc__)
src = Path(args[0])
out = root / "docs/static/img/table-themes"
if "--out" in args:
    out = Path(args[args.index("--out") + 1])
out.mkdir(parents=True, exist_ok=True)

themes = json.loads((root / "packages/sdvtables/data/table_themes.json").read_text(encoding="utf-8"))["themes"]
total = n = 0
for tid, entry in themes.items():
    sid = RENAMED.get(tid, tid)
    for mode in ("light", "dark"):
        if mode == "dark" and entry["darkPolicy"] == "none":
            continue
        png = src / f"{sid}-{mode}.png"
        if not png.exists():
            sys.exit(f"missing preview: {png}")
        dest = out / f"{tid}-{mode}.webp"
        Image.open(png).convert("RGB").save(dest, "WEBP", quality=QUALITY, method=6)
        total += dest.stat().st_size
        n += 1
print(f"{n} images, {total / 1e6:.1f} MB -> {out}")
