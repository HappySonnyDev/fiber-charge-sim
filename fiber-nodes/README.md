# Fiber 节点部署指南

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                      Fiber Charge Simulator                  │
│                         (浏览器端)                           │
│                    ┌──────────────────┐                     │
│                    │  User Node       │  ← Passkey          │
│                    │  (WASM Browser)  │                     │
│                    └────────┬─────────┘                     │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Router Node (必须)                      │
│                    ┌──────────────────┐                     │
│                    │  Fiber Router    │  ← 传统私钥         │
│                    │  (fnn binary)    │                     │
│                    └────────┬─────────┘                     │
└─────────────────────────────┼───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Tesla Station  │ │  NIO Station    │ │  XPeng Station  │
│  (fnn binary)   │ │  (fnn binary)   │ │  (fnn binary)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐
│  EA Station     │
│  (fnn binary)   │
└─────────────────┘
```

## 快速开始

### 1. 生成私钥

```bash
# 生成 Router 节点私钥
mkdir -p keys
openssl rand -hex 32 > keys/router_key

# 生成车商节点私钥
openssl rand -hex 32 > keys/tesla_key
openssl rand -hex 32 > keys/nio_key
openssl rand -hex 32 > keys/xpeng_key
openssl rand -hex 32 > keys/ea_key
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入生成的私钥
```

### 3. 启动 Router 节点（必须）

```bash
# 方式1: 使用启动脚本
./start-router.sh

# 方式2: 手动启动（推荐用于调试）
export FIBER_SECRET_KEY_PASSWORD='your-password'
./fnn -c config/router.yml -d data/router
```

### 4. 启动车商节点（可选，用于真实结算）

```bash
./start-stations.sh
```

## 配置文件说明

### Router 节点 (config/router.yml)

Router 是网络的中心节点，所有支付都需要经过它。

- RPC: 127.0.0.1:8227
- WebSocket: 127.0.0.1:8228

### 车商节点 (config/tesla.yml, config/nio.yml, etc.)

每个车商运行一个 Fiber 节点，用于：
- 接收用户支付
- 记录收入
- 结算统计

## 充值指南

1. 获取各节点的 CKB 地址（启动后会打印）
2. 去 https://faucet.nervos.org/ 领取测试币
3. 每个节点需要至少 200 CKB 来建立通道

## 查看节点状态

```bash
# Router 节点信息
curl http://127.0.0.1:8227 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'

# 列出通道
curl http://127.0.0.1:8227 -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"list_channels","params":[],"id":1}'
```
