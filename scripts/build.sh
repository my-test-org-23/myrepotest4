#!/usr/bin/env bash
# Build the whole app for production:
#   1. Compile the API (TypeScript -> server/dist)
#   2. Build the frontend (Vite -> web/dist)
#   3. Copy the built frontend into server/public so a single Node process
#      serves both the SPA and the API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing & building API"
cd "$ROOT/server"
npm ci || npm install
npm run build

echo "==> Installing & building web"
cd "$ROOT/web"
npm ci || npm install
npm run build

echo "==> Copying frontend into server/public"
rm -rf "$ROOT/server/public"
cp -r "$ROOT/web/dist" "$ROOT/server/public"

echo "==> Done. Start with: (cd server && npm start)"
