#!/bin/bash

# Start Fiber Router Node
# This is the central node that must be running for the network to work

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if fnn binary exists
FNN_BIN="${FNN_BIN:-./fnn}"
if [ ! -f "$FNN_BIN" ]; then
    echo "Error: fnn binary not found at $FNN_BIN"
    echo "Please download fnn from: https://github.com/nervosnetwork/fiber/releases"
    exit 1
fi

# Check if private key exists
if [ -z "$ROUTER_PRIVATE_KEY" ]; then
    echo "Error: ROUTER_PRIVATE_KEY not set in .env file"
    echo "Please generate a key with: openssl rand -hex 32 > keys/router_key"
    exit 1
fi

# Create data directory and key file (remove 0x prefix from key)
mkdir -p data/router/ckb
echo "$ROUTER_PRIVATE_KEY" | sed 's/^0x//' > data/router/ckb/key

echo "======================================"
echo "Starting Fiber Router Node"
echo "======================================"
echo "Name: ${ROUTER_NODE_NAME:-FiberRouter}"
echo "RPC: 127.0.0.1:8227"
echo "P2P: 0.0.0.0:8228"
echo "Data Dir: data/router"
echo "======================================"

# Set password for encrypting the key
export FIBER_SECRET_KEY_PASSWORD="fiber-router-password"

# Start the node
exec "$FNN_BIN" \
    -c config/router.yml \
    -d data/router
