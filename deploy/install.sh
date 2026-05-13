#!/bin/bash
# Install system dependencies on a fresh Ubuntu 22.04/24.04 VPS (run as root).
#
# Usage:
#   bash deploy/install.sh
#
# Installs: Node.js 20, build-essential (for better-sqlite3), Caddy, websocat,
#           ufw firewall rules.

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash $0"
    exit 1
fi

echo ">>> Updating apt cache..."
apt-get update -y

echo ">>> Installing base tools..."
apt-get install -y curl ca-certificates gnupg lsb-release \
    build-essential python3 git ufw debian-keyring debian-archive-keyring \
    apt-transport-https

# ---- Node.js 20 (NodeSource) ---------------------------------------------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
    echo ">>> Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node:  $(node -v)"
echo "npm :  $(npm -v)"

# ---- Caddy (official repo) -----------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
    echo ">>> Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -y
    apt-get install -y caddy
fi
echo "Caddy: $(caddy version)"

# ---- websocat (static binary) --------------------------------------------
if ! command -v websocat >/dev/null 2>&1; then
    echo ">>> Installing websocat..."
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  WS_ARCH="x86_64-unknown-linux-musl" ;;
        aarch64) WS_ARCH="aarch64-unknown-linux-musl" ;;
        *) echo "Unsupported arch: $ARCH"; exit 1 ;;
    esac
    curl -fsSL -o /usr/local/bin/websocat \
        "https://github.com/vi/websocat/releases/latest/download/websocat.${WS_ARCH}"
    chmod +x /usr/local/bin/websocat
fi
echo "websocat: $(websocat --version)"

# ---- Firewall ------------------------------------------------------------
echo ">>> Configuring ufw firewall..."
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http (caddy ACME)'
ufw allow 443/tcp comment 'https (next.js)'
ufw allow 8231/tcp comment 'wss (fiber router)'
# Fiber P2P on 8228/8238/.../8268 -- open if you want external Fiber peers:
# ufw allow 8228/tcp
ufw --force enable

echo
echo "============================================="
echo " System install complete."
echo " Next: bash deploy/setup.sh <vps-ip> <email>"
echo "============================================="
