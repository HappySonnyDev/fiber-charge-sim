# Fiber Charge Simulator Configuration Guide

## Environment Files

This project uses two separate environment configurations:

### 1. Frontend Configuration (Project Root)

File: `.env` (copy from `.env.frontend.example`)

Used by the React frontend for WebSocket connection to Router.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIBER_BOOTNODE` | WebSocket proxy address for bootnode | `/ip4/199.255.97.215/tcp/8231/ws` |
| `VITE_ROUTER_PUBKEY` | Router node pubkey for channel opening | `0x03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af` |
| `VITE_ROUTER_WS_ADDRESS` | Full WebSocket address with pubkey | `/ip4/199.255.97.215/tcp/8231/ws/p2p/03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af` |

### Optional

| Variable | Description |
|----------|-------------|
| `VITE_STATION_1_PUBKEY` | Tesla station pubkey |
| `VITE_STATION_2_PUBKEY` | NIO station pubkey |
| `VITE_STATION_3_PUBKEY` | XPeng station pubkey |
| `VITE_STATION_4_PUBKEY` | EA station pubkey |

### 2. Backend Node Configuration (fiber-nodes/)

File: `fiber-nodes/.env` (copy from `fiber-nodes/.env.example`)

Used by the Fiber Router and Station nodes for:
- Private keys
- RPC/WS endpoints
- Node names

See `fiber-nodes/.env.example` for details.

## Getting Your Configuration Values

### 1. External IP Address

```bash
curl ifconfig.me
```

### 2. Router Pubkey

```bash
cd fiber-nodes
./fnn-cli -u http://127.0.0.1:8227 info | grep pubkey
```

### 3. WebSocket Proxy Port

Default is `8231`. You can change it in `fiber-nodes/start-ws-proxy.sh`:

```bash
WS_PORT=8231 ./start-ws-proxy.sh
```

## Setup Steps

1. **Start Router and Station nodes**
   ```bash
   cd fiber-nodes
   ./start-router.sh
   ./start-stations.sh
   ```

2. **Start WebSocket proxy**
   ```bash
   ./start-ws-proxy.sh
   ```

3. **Copy frontend environment file**
   ```bash
   cp .env.frontend.example .env
   ```

4. **Edit `.env` with your values**
   ```bash
   # Replace with your actual values
   VITE_FIBER_BOOTNODE=/ip4/YOUR_IP/tcp/8231/ws
   VITE_ROUTER_PUBKEY=0xYOUR_ROUTER_PUBKEY
   VITE_ROUTER_WS_ADDRESS=/ip4/YOUR_IP/tcp/8231/ws/p2p/YOUR_ROUTER_PUBKEY
   ```

5. **Start frontend**
   ```bash
   npm run dev
   ```

## Firewall Configuration

Make sure port `8231` (or your custom WebSocket port) is open:

```bash
# On macOS
sudo lsof -i :8231  # Check if port is in use
```

If using a cloud server, open the port in your security group/firewall.

## Troubleshooting

### "Cannot connect to peer"
- Check WebSocket proxy is running: `ps aux | grep websocat`
- Verify firewall allows port 8231
- Check `.env` values match your actual IP and pubkey

### "Invalid parameter: Peer Pubkey feature not found"
- Browser node needs to connect to Router first
- Check `VITE_ROUTER_WS_ADDRESS` includes correct pubkey

### WebSocket connection fails
- Verify Router node is running: `./fnn-cli -u http://127.0.0.1:8227 info`
- Check WebSocket proxy logs
- Try local connection first: `VITE_FIBER_BOOTNODE=/ip4/127.0.0.1/tcp/8231/ws`
