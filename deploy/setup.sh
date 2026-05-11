#!/bin/bash
# Configure systemd units, Caddy, and build the Next.js app.
# Run after deploy/install.sh, from the project root (e.g. /opt/fiber-charge-sim).
#
# Usage:
#   bash deploy/setup.sh <vps-ip> <email>
# Example:
#   bash deploy/setup.sh 199.255.97.215 you@example.com

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash $0 <vps-ip> <email>"
    exit 1
fi

# Arg1 = VPS public IP (optional, auto-detect if omitted)
# Arg2 = email for Let's Encrypt (required)
VPS_IP="$1"
EMAIL="$2"

# If only one arg given, treat it as email and auto-detect IP.
if [ -n "$VPS_IP" ] && [ -z "$EMAIL" ] && [[ "$VPS_IP" == *@* ]]; then
    EMAIL="$VPS_IP"
    VPS_IP=""
fi

if [ -z "$VPS_IP" ]; then
    echo ">>> VPS_IP not provided, auto-detecting..."
    for svc in "https://api.ipify.org" "https://ifconfig.me" "https://icanhazip.com"; do
        VPS_IP=$(curl -fsSL --max-time 5 "$svc" 2>/dev/null | tr -d '[:space:]' || true)
        if [[ "$VPS_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "    detected via $svc -> $VPS_IP"
            break
        fi
        VPS_IP=""
    done
fi

if ! [[ "$VPS_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "ERROR: cannot determine VPS IP. Pass it explicitly:"
    echo "  bash $0 <vps-ip> <email>"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo "Usage: $0 [vps-ip] <email>"
    echo "  vps-ip:  public IPv4 (optional, auto-detected if omitted)"
    echo "  email :  contact email for Let's Encrypt (required)"
    exit 1
fi

# sslip.io: 1.2.3.4 -> 1-2-3-4.sslip.io  (dash form is friendlier for some certs)
DOMAIN="${VPS_IP//./-}.sslip.io"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo ">>> Project dir : $PROJECT_DIR"
echo ">>> Domain      : $DOMAIN"
echo ">>> Email       : $EMAIL"

if [ "$PROJECT_DIR" != "/opt/fiber-charge-sim" ]; then
    echo "WARN: project not at /opt/fiber-charge-sim - rewriting unit paths..."
fi

# ---- Make scripts executable --------------------------------------------
chmod +x "$PROJECT_DIR/fiber-nodes/start-router.sh" \
         "$PROJECT_DIR/fiber-nodes/start-stations.sh" \
         "$PROJECT_DIR/fiber-nodes/start-ws-proxy.sh" \
         "$PROJECT_DIR/fiber-nodes/setup-channels.sh" \
         "$PROJECT_DIR/fiber-nodes/fnn" \
         "$PROJECT_DIR/fiber-nodes/fnn-cli" \
         "$PROJECT_DIR/deploy/scripts/start-station.sh" \
         "$PROJECT_DIR/deploy/install.sh" \
         "$PROJECT_DIR/deploy/update.sh" 2>/dev/null || true

# ---- Quick sanity: fnn binary must be Linux ELF -------------------------
if ! file "$PROJECT_DIR/fiber-nodes/fnn" 2>/dev/null | grep -q "ELF"; then
    cat <<EOF

ERROR: fiber-nodes/fnn is not a Linux binary.
       Download the Linux build of fnn from:
         https://github.com/nervosnetwork/fiber/releases
       Place it at: $PROJECT_DIR/fiber-nodes/fnn  (and fnn-cli)

EOF
    exit 1
fi

# ---- Install systemd unit files (with path rewrite if needed) -----------
echo ">>> Installing systemd units..."
for unit in fiber-router.service fiber-station@.service fiber-ws-proxy.service fiber-charge-app.service; do
    src="$PROJECT_DIR/deploy/systemd/$unit"
    dst="/etc/systemd/system/$unit"
    sed "s|/opt/fiber-charge-sim|$PROJECT_DIR|g" "$src" > "$dst"
done
systemctl daemon-reload

# ---- Install Caddyfile --------------------------------------------------
echo ">>> Installing Caddyfile..."
install -d /etc/caddy
sed -e "s|{\\\$FCS_DOMAIN}|$DOMAIN|g" \
    -e "s|{\\\$FCS_EMAIL}|$EMAIL|g" \
    "$PROJECT_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl restart caddy
systemctl enable caddy

# ---- Build Next.js ------------------------------------------------------
cd "$PROJECT_DIR"
if [ ! -f .env ]; then
    cp deploy/env.production.template .env
    sed -i "s|__DOMAIN__|$DOMAIN|g" .env
    echo
    echo "NOTE: created $PROJECT_DIR/.env from template."
    echo "      Fill in __ROUTER_PUBKEY__ and STATION_*_CHANNEL_OUTPOINT"
    echo "      after running setup-channels.sh!"
    echo
fi

echo ">>> Installing npm deps..."
npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
echo ">>> Building Next.js..."
npm install --no-audit --no-fund   # need devDeps for build
npm run build
npm prune --omit=dev               # trim devDeps after build

# ---- Enable services ----------------------------------------------------
echo ">>> Enabling services..."
systemctl enable fiber-router.service
systemctl enable fiber-ws-proxy.service
systemctl enable fiber-station@tesla.service
systemctl enable fiber-station@nio.service
systemctl enable fiber-station@xpeng.service
systemctl enable fiber-station@ea.service
systemctl enable fiber-charge-app.service

cat <<EOF

=============================================
 Setup complete.

 Domain:  https://$DOMAIN
 WSS    : wss://$DOMAIN:8231

 Next steps:
   1. Edit fiber-nodes/.env  (private keys for router + 4 stations)
   2. systemctl start fiber-router
   3. systemctl start fiber-station@tesla fiber-station@nio fiber-station@xpeng fiber-station@ea
   4. systemctl start fiber-ws-proxy
   5. (first time only) cd fiber-nodes && ./setup-channels.sh
   6. Get ROUTER_PUBKEY:
        ./fiber-nodes/fnn-cli -u http://127.0.0.1:8227 info | grep pubkey
      Then edit /opt/fiber-charge-sim/.env and fill ROUTER_PUBKEY + outpoints.
   7. systemctl start fiber-charge-app
   8. Open https://$DOMAIN  (accept the cert; Caddy will issue automatically)

 Logs: journalctl -u fiber-router -f
       journalctl -u fiber-charge-app -f
=============================================
EOF
