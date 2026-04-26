#!/bin/bash

# Setup channels between Router and Station nodes
# This script establishes payment channels for multi-hop payments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

FNN_BIN="${FNN_BIN:-./fnn-cli}"
ROUTER_RPC="http://127.0.0.1:8227"

# Channel capacity (200 CKB = 20000000000 shannon)
CHANNEL_CAPACITY="20000000000"

echo "======================================"
echo "Setting up Fiber Channels"
echo "======================================"
echo "Router RPC: $ROUTER_RPC"
echo "Channel Capacity: $(echo "$CHANNEL_CAPACITY / 100000000" | bc) CKB"
echo "======================================"

# Function to open channel from Router to Station
open_channel() {
    local station_name=$1
    local station_rpc=$2
    local station_pubkey=$3
    local station_p2p_addr=$4
    
    echo ""
    echo "Setting up channel: Router -> $station_name"
    echo "Station Pubkey: $station_pubkey"
    echo "Station P2P: $station_p2p_addr"
    
    # Check if channel already exists
    existing_channel=$($FNN_BIN -u "$ROUTER_RPC" channel list_channels 2>/dev/null | grep "$station_pubkey" || true)
    if [ -n "$existing_channel" ]; then
        echo "Channel already exists, skipping..."
        return
    fi
    
    # First connect to the peer
    echo "Connecting to $station_name..."
    $FNN_BIN -u "$ROUTER_RPC" peer connect_peer --pubkey "$station_pubkey" --address "$station_p2p_addr" 2>&1 || echo "(Connection may already exist)"
    
    sleep 2
    
    # Open channel using fnn-cli
    echo "Opening channel..."
    $FNN_BIN -u "$ROUTER_RPC" channel open_channel \
        --pubkey "$station_pubkey" \
        --funding-amount "$CHANNEL_CAPACITY" \
        2>&1 && echo "Channel opened successfully!" || echo "Failed to open channel (may need to wait for funding)"
}

# Wait for nodes to be ready
echo ""
echo "Waiting for nodes to be ready..."
sleep 3

# Open channels from Router to each station
# P2P addresses are in the format: /ip4/127.0.0.1/tcp/<port>
open_channel "Tesla" "http://127.0.0.1:8237" "$TESLA_PUBKEY" "/ip4/127.0.0.1/tcp/8238"
open_channel "NIO" "http://127.0.0.1:8247" "$NIO_PUBKEY" "/ip4/127.0.0.1/tcp/8248"
open_channel "XPeng" "http://127.0.0.1:8257" "$XPENG_PUBKEY" "/ip4/127.0.0.1/tcp/8258"
open_channel "EA" "http://127.0.0.1:8267" "$EA_PUBKEY" "/ip4/127.0.0.1/tcp/8268"

echo ""
echo "======================================"
echo "Channel setup complete!"
echo "======================================"
echo ""
echo "Checking Router channels:"
$FNN_BIN -u "$ROUTER_RPC" channel list_channels 2>/dev/null || echo "(CLI not available, check via RPC)"
