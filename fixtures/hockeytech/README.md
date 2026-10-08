# HockeyTech canvas fixtures (real PWHL play-by-play)

Real coordinates for sporty's `hockeytech` frame (`packages/sporty/test/frames.test.ts`). Never hand-edit.

- `pwhl_pbp_42_coords.json`: PWHL game 42 (2024-03-02), HockeyTech `statviewfeed/gameCenterPlayByPlay`, every
  `shot`, `goal`, `faceoff` and `hit` event as `{ event, x, y }` from `details.xLocation`/`details.yLocation`, in feed
  order. 139 events (48 faceoffs, 66 shots, 21 hits, 4 goals; 8 faceoffs at centre ice (300, 150)); x 9-589, y 3-297.
- Source: sdv-py `tests/fixtures/hockeytech/pwhl_pbp_42.json` (committed in `ac12268f95`, #95; sha256
  `bac667ea8d5b2a43291be9dd2a6515a5e6e0f054538265b88899cb8e06c6da9a`).
- Command (from this directory):
  `node -e 'const fs=require("fs");const rows=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).filter(e=>["shot","goal","faceoff","hit"].includes(e.event)).map(e=>({event:e.event,x:e.details.xLocation,y:e.details.yLocation}));fs.writeFileSync("pwhl_pbp_42_coords.json","[\n"+rows.map(r=>JSON.stringify(r)).join(",\n")+"\n]\n")' <sdv-py>/tests/fixtures/hockeytech/pwhl_pbp_42.json`
- Why 600x300 and only one HockeyTech frame: a 2026-10-08 probe of PWHL (all 320 stored games, 45,733 events: x 0-600,
  y 0-300), AHL, OHL and ECHL found every league on the same 600x300 canvas with the same nine faceoff dots; no feed
  ships an 850x400 canvas.
