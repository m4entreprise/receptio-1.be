#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
TARGET_DIR="${1:-$ROOT_DIR/.deploy/frontend}"
API_URL="${VITE_API_URL:-https://ethereal-gnome-owpihmtfy4.ploi.ing}"

export VITE_API_URL="$API_URL"

cd "$FRONTEND_DIR"
npm ci
npm run build

mkdir -p "$TARGET_DIR"
find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R dist/. "$TARGET_DIR/"

cat > "$TARGET_DIR/.htaccess" <<'EOF'
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
EOF

echo "Frontend déployé dans $TARGET_DIR"
echo "VITE_API_URL utilisé: $VITE_API_URL"
