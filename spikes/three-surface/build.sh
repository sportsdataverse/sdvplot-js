#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# esbuild is only tsup's transitive dependency (no root .bin entry, `pnpm exec esbuild` fails): run the version tsup ^8 resolves
pnpm dlx esbuild@0.27.7 spike.ts --bundle --format=esm --platform=browser --external:three --external:three/addons/* --outfile=spike.js
echo "built spike.js"
