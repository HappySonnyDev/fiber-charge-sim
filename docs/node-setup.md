# Fiber 节点配置指南

本文档说明如何配置和启动 Router 节点以及 4 个车商节点，用于 Fiber 充电模拟器。

## 架构概述

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   用户浏览器  │◄────►│  Router 节点  │◄────►│  车商节点    │
│ (WASM Node) │      │  (Bootnode) │      │ (4 stations)│
└─────────────┘      └─────────────┘      └─────────────┘
```

## 1. 启动 Router 节点 (Bootnode)

Router 节点作为网络的入口点，用户浏览器节点通过它发现和连接车商节点。

```bash
cd /Users/sonny/Downloads/fnn_v0.8.0-x86_64-darwin-portable

# 创建 router 配置目录
mkdir -p router

# 启动 router 节点
./fnn \
  --config router \
  --ckb-rpc-url https://testnet.ckbapp.dev/ \
  --network testnet \
  --listen-addr /ip4/0.0.0.0/tcp/8228 \
  --announce-addr /ip4/YOUR_PUBLIC_IP/tcp/8228
```

获取 Router 节点的 Multiaddr：
```bash
# 在另一个终端运行
curl -X POST http://127.0.0.1:8227 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'
```

记录返回的 `addresses` 字段，例如：
`/ip4/192.168.1.100/tcp/8228/p2p/QmRouterNodeId...`

## 2. 启动车商节点

为每个车商启动一个 Fiber 节点：

### Tesla 节点
```bash
mkdir -p station_tesla

./fnn \
  --config station_tesla \
  --ckb-rpc-url https://testnet.ckbapp.dev/ \
  --network testnet \
  --listen-addr /ip4/0.0.0.0/tcp/8230 \
  --bootnodes /ip4/ROUTER_IP/tcp/8228/p2p/ROUTER_PEER_ID
```

### NIO 节点
```bash
mkdir -p station_nio

./fnn \
  --config station_nio \
  --ckb-rpc-url https://testnet.ckbapp.dev/ \
  --network testnet \
  --listen-addr /ip4/0.0.0.0/tcp/8231 \
  --bootnodes /ip4/ROUTER_IP/tcp/8228/p2p/ROUTER_PEER_ID
```

### XPeng 节点
```bash
mkdir -p station_xpeng

./fnn \
  --config station_xpeng \
  --ckb-rpc-url https://testnet.ckbapp.dev/ \
  --network testnet \
  --listen-addr /ip4/0.0.0.0/tcp/8232 \
  --bootnodes /ip4/ROUTER_IP/tcp/8228/p2p/ROUTER_PEER_ID
```

### EA 节点
```bash
mkdir -p station_ea

./fnn \
  --config station_ea \
  --ckb-rpc-url https://testnet.ckbapp.dev/ \
  --network testnet \
  --listen-addr /ip4/0.0.0.0/tcp/8233 \
  --bootnodes /ip4/ROUTER_IP/tcp/8228/p2p/ROUTER_PEER_ID
```

## 3. 获取节点 Pubkeys

每个节点启动后，获取它们的 pubkey：

```bash
# Tesla
curl -X POST http://127.0.0.1:8230 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'

# NIO
curl -X POST http://127.0.0.1:8231 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'

# XPeng
curl -X POST http://127.0.0.1:8232 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'

# EA
curl -X POST http://127.0.0.1:8233 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'
```

记录每个节点的 `pubkey` 字段。

## 4. 配置前端环境变量

在项目根目录创建 `.env.local` 文件：

```env
# Router 节点的 Multiaddr (用于浏览器节点连接)
VITE_FIBER_BOOTNODE=/ip4/ROUTER_IP/tcp/8228/p2p/ROUTER_PEER_ID

# 车商节点 Pubkeys
VITE_STATION_1_PUBKEY=0xTESLA_PUBKEY
VITE_STATION_2_PUBKEY=0xNIO_PUBKEY
VITE_STATION_3_PUBKEY=0xXPENG_PUBKEY
VITE_STATION_4_PUBKEY=0xEA_PUBKEY
```

## 5. 建立通道 (Channels)

用户需要与 Router 节点建立通道，Router 需要与各个车商建立通道。

### 用户 -> Router 通道
用户通过浏览器节点 UI 操作建立通道（首次连接时会提示）。

### Router -> 车商通道
```bash
# 在 Router 节点上执行，连接到 Tesla
curl -X POST http://127.0.0.1:8227 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "connect_peer",
    "params": [{
      "address": "/ip4/127.0.0.1/tcp/8230/p2p/TESLA_PEER_ID"
    }],
    "id": 1
  }'

# 打开通道
curl -X POST http://127.0.0.1:8227 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "open_channel",
    "params": [{
      "peer_id": "TESLA_PEER_ID",
      "funding_amount": "0x174876E00",
      "public": true
    }],
    "id": 1
  }'
```

对其他车商重复上述步骤。

## 6. 充值 CKB Testnet 代币

每个节点需要有 CKB testnet 代币来支付通道费用：

1. 获取每个节点的 CKB 地址：
```bash
curl -X POST http://127.0.0.1:8227 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'
# 查看 default_funding_lock_script 中的 args 字段
```

2. 使用 CKB Testnet Faucet 获取测试代币：
   - 访问 https://faucet.nervos.org/
   - 输入地址获取测试 CKB

## 7. 启动前端应用

```bash
cd /Users/sonny/.qoderwork/workspace/mnzptdlhi7mi3jky/fiber-charge-sim
npm run dev
```

访问 http://localhost:5173，点击 "CONNECT FIBER NODE" 按钮连接你的浏览器节点。

## 故障排除

### 节点无法连接
- 检查防火墙设置，确保端口开放
- 确认 bootnodes 地址正确

### 通道建立失败
- 确保节点有足够的 CKB 余额
- 检查节点之间的网络连通性

### 浏览器节点无法启动
- 确保使用现代浏览器（Chrome/Edge/Firefox）
- 检查是否支持 WebAuthn/Passkey
- 查看浏览器控制台错误信息
