#!/bin/bash
# Pull latest code, rebuild Next.js, and restart the app.
# Fiber nodes are NOT restarted (avoid disturbing channel state).
#
# Usage:
#   bash deploy/update.sh

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash $0"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo ">>> git pull..."
git pull --ff-only

echo ">>> npm install + build..."
npm install --no-audit --no-fund
npm run build
npm prune --omit=dev

echo ">>> Restart Next.js app (fiber nodes left running)..."
systemctl restart fiber-charge-app

echo ">>> Done. Tail logs with:  journalctl -u fiber-charge-app -f"
