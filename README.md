# Fiber Charge Sim

基于 Nervos Fiber 的电动车充电支付模拟器：前端（Next.js 15 + WASM Fiber 轻节点）+ 后端 API Routes + SQLite 后台管理 + Router/Station Fiber 节点 + Trampoline 多跳路由。

## 快速上手

**本地开发**
```bash
npm install
cd fiber-nodes && ./start-router.sh & ./start-stations.sh & ./start-ws-proxy.sh
cd .. && npm run dev
```

**VPS 生产部署** → 详见 [`deploy/README.md`](./deploy/README.md)

## 目录说明

| 路径 | 说明 |
|---|---|
| `src/` | Next.js 前端 + API Routes |
| `fiber-nodes/` | Router + 4 个 Station Fiber 节点（`fnn` 二进制、配置、启动脚本） |
| `deploy/` | VPS 单机部署脚本（systemd + Caddy + sslip.io），见 [`deploy/README.md`](./deploy/README.md) |
| `data/` | SQLite 数据库（运行时生成） |
| `docs/` | 附加文档 |
| `CONFIG.md` | 环境变量说明 |

## 相关文档

- [部署手册](./deploy/README.md)
- [环境变量说明](./CONFIG.md)
- [节点配置](./docs/node-setup.md)
