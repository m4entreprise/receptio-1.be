#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier .env introuvable à la racine du projet: $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKEND_DIR/logs" "$BACKEND_DIR/uploads" "$BACKEND_DIR/recordings"

cd "$BACKEND_DIR"
npm ci
npm run build

echo "Backend buildé dans $BACKEND_DIR/dist"
echo "Startup file à configurer dans le panel NodeJS: dist/index.js"
