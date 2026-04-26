#!/bin/bash

# WebSocket to TCP proxy for Fiber Router node
# This allows browser-based WASM nodes to connect to the local Router

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
WS_PORT=${WS_PORT:-8231}
ROUTER_P2P_PORT=${ROUTER_P2P_PORT:-8228}
ROUTER_P2P_ADDR="/ip4/127.0.0.1/tcp/$ROUTER_P2P_PORT"

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me)

echo "======================================"
echo "Fiber WebSocket Proxy"
echo "======================================"
echo "WebSocket Port: $WS_PORT"
echo "Router P2P: $ROUTER_P2P_ADDR"
echo "External IP: $EXTERNAL_IP"
echo "======================================"
echo ""
echo "Starting WebSocket to TCP proxy..."
echo ""
echo "For local testing: ws://127.0.0.1:$WS_PORT"
echo "For external access: ws://$EXTERNAL_IP:$WS_PORT"
echo ""
echo "Add to your .env file:"
echo "VITE_FIBER_BOOTNODE=/ip4/$EXTERNAL_IP/tcp/$WS_PORT/ws"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Check if websocat is installed
if ! command -v websocat &> /dev/null; then
    echo "Error: websocat is not installed. Please install it first:"
    echo "  brew install websocat"
    exit 1
fi

# Start the proxy
# This forwards WebSocket connections to the Router's TCP P2P port
# Format: websocat ws-listen:PORT tcp:HOST:PORT
# --binary is required for Fiber's binary P2P protocol
echo "Starting WebSocket proxy (binary mode)..."
websocat --binary ws-listen:0.0.0.0:$WS_PORT tcp:127.0.0.1:$ROUTER_P2P_PORT
