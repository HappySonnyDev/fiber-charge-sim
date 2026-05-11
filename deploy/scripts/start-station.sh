#!/bin/bash
# Wrapper used by fiber-station@.service systemd unit.
# Usage: start-station.sh <name>   (name = tesla|nio|xpeng|ea)

set -e

STATION="$1"
if [ -z "$STATION" ]; then
    echo "Usage: $0 <tesla|nio|xpeng|ea>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIBER_DIR="$SCRIPT_DIR/../../fiber-nodes"
cd "$FIBER_DIR"

# Load env (already loaded by systemd via EnvironmentFile, but keep for manual run)
if [ -f .env ]; then
    set -a; . ./.env; set +a
fi

FNN_BIN="${FNN_BIN:-./fnn}"
if [ ! -x "$FNN_BIN" ]; then
    echo "Error: fnn binary not found or not executable at $FIBER_DIR/$FNN_BIN"
    exit 1
fi

# Pick per-station vars
KEY_VAR="$(echo "$STATION" | tr 'a-z' 'A-Z')_PRIVATE_KEY"
KEY_VAL="${!KEY_VAR}"
if [ -z "$KEY_VAL" ]; then
    echo "Error: $KEY_VAR not set in fiber-nodes/.env"
    exit 1
fi

CONFIG="config/${STATION}.yml"
DATA_DIR="data/${STATION}"
PASSWORD="fiber-${STATION}-password"

if [ ! -f "$CONFIG" ]; then
    echo "Error: config $CONFIG not found"
    exit 1
fi

mkdir -p "$DATA_DIR/ckb"
echo "$KEY_VAL" | sed 's/^0x//' > "$DATA_DIR/ckb/key"
chmod 600 "$DATA_DIR/ckb/key"

export FIBER_SECRET_KEY_PASSWORD="$PASSWORD"

exec "$FNN_BIN" -c "$CONFIG" -d "$DATA_DIR"
