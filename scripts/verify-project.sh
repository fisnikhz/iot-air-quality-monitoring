#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking API..."
(
  cd "$ROOT_DIR/services/api"
  npm test -- --runInBand
  npx eslint "{src,apps,libs,test}/**/*.ts"
  npm run build
)

echo "Checking dashboard..."
(
  cd "$ROOT_DIR/apps/web"
  npm run lint
  npm run build
)

echo "Checking simulator..."
(
  cd "$ROOT_DIR/simulator/sensor-emitter"
  npm run build
)

if [[ "${E2E:-0}" == "1" ]]; then
  echo "Checking live pipeline..."
  (
    cd "$ROOT_DIR/apps/web"
    npm run verify:e2e
  )
fi

echo "Project verification passed."
