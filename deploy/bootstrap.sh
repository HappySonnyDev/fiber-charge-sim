#!/bin/bash
# Bootstrap: start all fiber services, extract pubkeys & channel outpoints,
# fill them into /opt/fiber-charge-sim/.env, then start the web app.
#
# Idempotent — safe to re-run after partial failure.
#
# Usage:
#   bash deploy/bootstrap.sh

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash $0"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

FIBER_DIR="$PROJECT_DIR/fiber-nodes"
CLI="$FIBER_DIR/fnn-cli"
ENV_FILE="$PROJECT_DIR/.env"
FIBER_ENV="$FIBER_DIR/.env"

if [ ! -x "$CLI" ]; then
    echo "ERROR: $CLI not found. Did you download Linux fnn binary?"
    exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found. Run deploy/setup.sh first."
    exit 1
fi

STATIONS=(tesla nio xpeng ea)
declare -A STATION_RPC=( [tesla]=8237 [nio]=8247 [xpeng]=8257 [ea]=8267 )
declare -A STATION_SLOT=( [tesla]=1 [nio]=2 [xpeng]=3 [ea]=4 )
declare -A STATION_PUBKEY

ROUTER_RPC="http://127.0.0.1:8227"

wait_rpc() {
    local url="$1" name="$2"
    for i in $(seq 1 30); do
        if "$CLI" -u "$url" info >/dev/null 2>&1; then
            echo "  $name RPC ready."
            return 0
        fi
        sleep 1
    done
    echo "ERROR: $name RPC $url did not become ready in 30s."
    exit 1
}

extract_pubkey() {
    # Return the first 0x-prefixed 66-hex field from fnn-cli info output.
    "$CLI" -u "$1" info 2>/dev/null | grep -oE '0x[a-f0-9]{66}' | head -1
}

# ============================================================
# Step 5.1 — Start router
# ============================================================
echo ">>> [1/7] Starting fiber-router..."
systemctl start fiber-router
wait_rpc "$ROUTER_RPC" "Router"

# ============================================================
# Step 5.2 — Start stations
# ============================================================
echo ">>> [2/7] Starting fiber-station@{tesla,nio,xpeng,ea}..."
for s in "${STATIONS[@]}"; do
    systemctl start "fiber-station@$s"
done
for s in "${STATIONS[@]}"; do
    wait_rpc "http://127.0.0.1:${STATION_RPC[$s]}" "station-$s"
done

# ============================================================
# Step 5.3 — Start websocket proxy
# ============================================================
echo ">>> [3/7] Starting fiber-ws-proxy..."
systemctl start fiber-ws-proxy

# ============================================================
# Step 6.1 — Extract Router + Station pubkeys
# ============================================================
echo ">>> [4/7] Extracting pubkeys..."
ROUTER_PUBKEY=$(extract_pubkey "$ROUTER_RPC")
ROUTER_PUBKEY_NO_PREFIX=${ROUTER_PUBKEY#0x}
if [ -z "$ROUTER_PUBKEY" ]; then
    echo "ERROR: failed to read router pubkey."
    exit 1
fi
echo "  Router : $ROUTER_PUBKEY"

for s in "${STATIONS[@]}"; do
    pk=$(extract_pubkey "http://127.0.0.1:${STATION_RPC[$s]}")
    STATION_PUBKEY[$s]="$pk"
    echo "  $s: $pk"

    # Write <NAME>_PUBKEY into fiber-nodes/.env (setup-channels.sh reads it)
    key_var="$(echo "$s" | tr '[:lower:]' '[:upper:]')_PUBKEY"
    if grep -q "^${key_var}=" "$FIBER_ENV" 2>/dev/null; then
        sed -i "s|^${key_var}=.*|${key_var}=$pk|" "$FIBER_ENV"
    else
        echo "${key_var}=$pk" >> "$FIBER_ENV"
    fi
done

# ============================================================
# Step 6.2 — Open channels if missing
# ============================================================
echo ">>> [5/7] Checking channels..."
channel_count() {
    "$CLI" -u "$ROUTER_RPC" channel list_channels '[{}]' 2>/dev/null \
        | grep -c '"channel_outpoint"' || true
}

CUR=$(channel_count)
echo "  existing channels: $CUR / 4"
if [ "$CUR" -lt 4 ]; then
    echo "  running setup-channels.sh ..."
    ( cd "$FIBER_DIR" && bash setup-channels.sh ) || true
    echo "  waiting for 4 channels to appear (up to 2 minutes)..."
    for i in $(seq 1 24); do
        CUR=$(channel_count)
        if [ "$CUR" -ge 4 ]; then break; fi
        echo "    [$i/24] $CUR/4 channels..."
        sleep 5
    done
fi

if [ "$CUR" -lt 4 ]; then
    echo "WARN: only $CUR/4 channels visible. Continuing anyway; you can re-run"
    echo "      this script later once funding transactions confirm."
fi

# ============================================================
# Step 7 — Map outpoints to stations, rewrite .env
# ============================================================
echo ">>> [6/7] Writing pubkey + outpoints into $ENV_FILE..."

CHANNELS_JSON=$("$CLI" -u "$ROUTER_RPC" channel list_channels '[{}]' 2>/dev/null || echo '{}')

get_outpoint_for_peer() {
    # $1 = station pubkey (with or without 0x)
    local pk="${1#0x}"
    python3 - "$pk" <<PY
import sys, json, re
pk = sys.argv[1].lower()
raw = """$CHANNELS_JSON"""
try:
    data = json.loads(raw)
except Exception:
    print(""); sys.exit(0)

# Navigate common shapes: {result:{channels:[...]}} or {channels:[...]} or list
def channels(d):
    if isinstance(d, list): return d
    if isinstance(d, dict):
        if 'channels' in d: return d['channels']
        if 'result' in d: return channels(d['result'])
    return []

for ch in channels(data):
    peer = str(ch.get('peer_id') or ch.get('peer_pubkey') or '').lower()
    if pk in peer:
        print(ch.get('channel_outpoint', ''))
        break
PY
}

# Router pubkey — replace __ROUTER_PUBKEY__ placeholder everywhere
sed -i "s|__ROUTER_PUBKEY__|$ROUTER_PUBKEY_NO_PREFIX|g" "$ENV_FILE"

# Per-station outpoints
for s in "${STATIONS[@]}"; do
    slot=${STATION_SLOT[$s]}
    op=$(get_outpoint_for_peer "${STATION_PUBKEY[$s]}")
    if [ -z "$op" ]; then
        echo "  STATION_${slot} ($s): NOT FOUND (channel may still be pending)"
        continue
    fi
    echo "  STATION_${slot} ($s) -> $op"
    if grep -q "^STATION_${slot}_CHANNEL_OUTPOINT=" "$ENV_FILE"; then
        sed -i "s|^STATION_${slot}_CHANNEL_OUTPOINT=.*|STATION_${slot}_CHANNEL_OUTPOINT=$op|" "$ENV_FILE"
    else
        echo "STATION_${slot}_CHANNEL_OUTPOINT=$op" >> "$ENV_FILE"
    fi
done

# ============================================================
# Step 8 — Start the web app
# ============================================================
echo ">>> [7/7] Starting fiber-charge-app..."
systemctl restart fiber-charge-app
sleep 3

DOMAIN=$(grep -oE 'dns4/[^/]+' "$ENV_FILE" | head -1 | cut -d/ -f2)

cat <<EOF

=============================================
 Bootstrap complete.

 Open:  https://${DOMAIN:-<your-domain>}

 Status:
   systemctl status fiber-router fiber-ws-proxy fiber-charge-app --no-pager
 Logs:
   journalctl -u fiber-charge-app -f
   journalctl -u fiber-router    -f
=============================================
EOF
