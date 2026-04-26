#!/bin/bash

# Start all station nodes (Tesla, NIO, XPeng, EA)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

FNN_BIN="${FNN_BIN:-./fnn}"

if [ ! -f "$FNN_BIN" ]; then
    echo "Error: fnn binary not found at $FNN_BIN"
    exit 1
fi

# Function to start a station node
start_station() {
    local name=$1
    local config=$2
    local key=$3
    local data_dir=$4
    local password=$5
    
    if [ -z "$key" ]; then
        echo "Warning: ${name} private key not set, skipping..."
        return
    fi
    
    echo "Starting ${name}..."
    mkdir -p "$data_dir/ckb"
    echo "$key" | sed 's/^0x//' > "$data_dir/ckb/key"
    
    FIBER_SECRET_KEY_PASSWORD="$password" "$FNN_BIN" \
        -c "$config" \
        -d "$data_dir" &
    
    echo "${name} started with PID $!"
}

echo "======================================"
echo "Starting Fiber Station Nodes"
echo "======================================"

# Start Tesla
start_station "Tesla" "config/tesla.yml" "$TESLA_PRIVATE_KEY" "data/tesla" "fiber-tesla-password"

# Start NIO
start_station "NIO" "config/nio.yml" "$NIO_PRIVATE_KEY" "data/nio" "fiber-nio-password"

# Start XPeng
start_station "XPeng" "config/xpeng.yml" "$XPENG_PRIVATE_KEY" "data/xpeng" "fiber-xpeng-password"

# Start EA
start_station "EA" "config/ea.yml" "$EA_PRIVATE_KEY" "data/ea" "fiber-ea-password"

echo "======================================"
echo "All stations started!"
echo "======================================"
echo "Use 'ps aux | grep fnn' to check status"
echo "Use 'killall fnn' to stop all nodes"

# Wait for all background processes
wait
