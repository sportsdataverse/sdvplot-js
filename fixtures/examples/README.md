# Example fixtures

Real bytes the examples gate serves to `network`-tagged examples (`examples/test/run.ts` `FIXTURES`), so an example
that fetches still runs offline.

- `<sha256>.png`: team logos as the sdvplot archive serves them,
  `https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/<first 2>/<sha256>.png`, the URL `logoUrlSync`
  returns. The name is the sha256 of the file (`examples/test/run.test.ts` checks it). Fetched 2026-10-08.
  - `3d77958d….png`: KC (nfl), 500 × 500, 40,228 bytes
  - `5400f85b….png`: LAC (nfl), 500 × 500, 32,850 bytes
