# Brand assets

`hex-logo.ts` draws the sdvplot-js hex logo, its small mark, the favicons and the GitHub social card. It is a
TypeScript port of the family recipe in the sibling Python package (`sdvplot/tools/hex_logo.py`), which itself
ports sdvplotR's "Axis" hex (`sdvplotR/data-raw/hex_logo.R`).

```bash
pnpm brand   # needs the network: it downloads the eight team logos
```

The script builds each image as an SVG and rasterises it with `@resvg/resvg-js` (a root devDependency), loading
Russo One from this folder. Team colours and logo URLs come from this repo's `@sportsdataverse/sdvplot` data
(`preloadAll`, `teamColorsSync`, `logoUrlSync`), imported from the package source.

## What it writes (`docs/static/img/`)

| File | Size | Notes |
| --- | --- | --- |
| `sdvplot-js-logo.svg` | 1036 x 1200 | the hex, starfield and logos embedded as data URIs (~2 MB) |
| `sdvplot-js-logo.png` | 1036 x 1200 | the README logo |
| `sdvplot-js-mark.svg` | 1036 x 1200 | hex + wordmark + bars on a flat dark fill, no images (< 20 KB); navbar logo |
| `favicon.ico` | 16, 32, 48 | the mark, PNG-in-ICO |
| `favicon-192.png`, `favicon-512.png` | 192, 512 | the full hex on a transparent square |
| `apple-touch-icon.png` | 180 | the full hex on an opaque `#071224` square |
| `social-card.png` | 1280 x 640 | GitHub social preview and the docs' `og:image` |

`brand.test.ts` checks the committed files (PNG dimensions, three ICO images, mark size) without re-rendering.
GitHub has no API for a repo's social preview: upload `social-card.png` by hand under Settings → General.

## The design

As the Python recipe: a pointy-top hex with a 30 px print-safe inset; the starfield cropped to 1040 x 1200 with
its middle band (behind the chart) replaced by a gain-matched, feathered copy of the clean top strip (done on the
decoded pixels, then re-encoded by a small PNG writer in the script); the wordmark in Russo One with the SDV
gradient `#3346F0` → `#7FE6DC`, ink top at y 0.627, at sdvplotR's type size (its "sdvplotR" spans 583 px). The
script checks every inked pixel of `sdvplot-js` against the safe hex and would scale the word down if needed; at
the sibling's size it fits, so it is not scaled. Edge `#071224`, grid and axis ice `#9CCBFF`.

The text is converted to outlines (resvg's own text-to-path output), so the committed SVGs render without the
font installed.

## The eight teams

One per league, none shared with sdvplotR (KC BOS NY LAD PHI FSU PUR SC) or sdvplot (MIA GS CHI CIN DAL TENN KU
LSU), picked for eight distinct hues that read on the dark starfield. The script fails if any primary colour is
below 2.5:1 (sdvplot's `contrast`) against the mean colour of the starfield band behind the chart (`#021e3a`).

| League | Team | Primary | Contrast | Bar height |
| --- | --- | --- | --- | --- |
| nfl | CAR Carolina Panthers | `#0085ca` | 4.17 | 0.46 |
| nba | POR Portland Trail Blazers | `#e03a3e` | 3.88 | 0.62 |
| wnba | LV Las Vegas Aces | `#a7a8aa` | 7.06 | 0.54 |
| mlb | BAL Baltimore Orioles | `#df4601` | 4.01 | 0.72 |
| nhl | NSH Nashville Predators | `#fdba31` | 9.80 | 0.60 |
| cfb | ORE Oregon | `#00934b` | 4.22 | 0.80 |
| mbb | UNC North Carolina | `#7bafd4` | 7.14 | 0.68 |
| wbb | MD Maryland | `#ce1126` | 2.99 | 0.76 |

The logos are each team's `variant: "dark"` mark from sdvplot's content-addressed archive (MIT-redistributable per
the package's NOTICE):

- CAR: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/2c/2cebc1bbdcfd89f28c1578b397f440d229d93fa9a30bfa1193cc286482c82298.png>
- POR: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/a7/a7659220f84c4efa5f0b5f529a397043c7ecdb84469cb344b554546ba9634086.png>
- LV: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/d3/d3057fc57ddcd581b22821cab1d5fcc21a6e7b9e9bc7a0dcc57c3ef4e8284523.png>
- BAL: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/2a/2a04fdb7e1c1ae25843ab5e39b1d289ae7031af9d1a2e374d5d5881c381664c3.png>
- NSH: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/4d/4d2e7def5af8332185bcfeb59fc9633f4fb30417262aa05e68095d93e4e12c2d.png>
- ORE: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/9e/9eb66f081f81155873b0324660d9f2b99ff0f08dd75c08aeab3c6bc9c603bcab.png>
- UNC: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/1b/1b97de7c237a786828d2a033d44c93b1d7dcf01ce8d3822422c454cd610316b4.png>
- MD: <https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/ed/ed9962d4da64bd912bf530ce15320d53c867532564baa648ccb119056007e1a4.png>

## Provenance

- `sdv-starfield.png`: the SportsDataverse starfield, the ground of the org's hex stickers (1200 x 1200 RGBA),
  copied unchanged from `sdvplot/tools/brand/`.
- `RussoOne-Regular.ttf`: Russo One by Jovanny Lemonad, SIL Open Font License 1.1; the licence is `OFL.txt`, which
  must travel with the font. Copied from `sdvplot/tools/brand/`.
