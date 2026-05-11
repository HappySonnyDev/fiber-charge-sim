# Fiber Charge Sim — VPS 部署手册

整个项目（Next.js 前端/API + Router + 4 个 Station + WebSocket 代理 + SQLite）跑在**单台 VPS**上，使用 sslip.io 免费域名 + Caddy 自动 HTTPS + systemd 守护。

## 0. 准备

- 一台 Ubuntu 22.04 / 24.04 LTS VPS（建议 2 vCPU / 4 GB RAM / 40 GB SSD）
- 公网 IPv4，例如 `199.255.97.215`
- 域名自动是 `199-255-97-215.sslip.io`，**不用注册任何东西**
- 防火墙/安全组放行 TCP 22 / 80 / 443 / 8231

## 1. 上传代码

在 VPS 上以 root 执行：

```bash
mkdir -p /opt && cd /opt
git clone <你的仓库地址> fiber-charge-sim
cd fiber-charge-sim
```

如果是从本机 scp，**记得不要带 macOS 的 `fnn` 二进制**——必须换成 Linux 版本：

```bash
# 在 VPS 上下载 Linux 版 fnn / fnn-cli
cd /opt/fiber-charge-sim/fiber-nodes
# 去 https://github.com/nervosnetwork/fiber/releases 找对应版本，例如：
curl -L -o fnn.tar.gz https://github.com/nervosnetwork/fiber/releases/download/<VERSION>/fnn-x86_64-unknown-linux-gnu.tar.gz
tar xzf fnn.tar.gz
chmod +x fnn fnn-cli
```

## 2. 安装系统依赖（一键）

```bash
bash /opt/fiber-charge-sim/deploy/install.sh
```

会装：Node.js 20、build-essential（编译 better-sqlite3 用）、Caddy、websocat、ufw 防火墙规则。

## 3. 准备私钥

编辑 `fiber-nodes/.env`，填好 5 个节点的私钥（从你本机的 `.env` 复制过来即可）：

```bash
ROUTER_PRIVATE_KEY=...
TESLA_PRIVATE_KEY=...
NIO_PRIVATE_KEY=...
XPENG_PRIVATE_KEY=...
EA_PRIVATE_KEY=...
```

> 如果你想**搬旧通道**过来，把本机 `fiber-nodes/data/` 整个 rsync 过去（关闭本机 fnn 后再传，避免 RocksDB 损坏）。否则会在第 5 步重新开通道。

## 4. 安装 systemd 单元 + 构建前端

```bash
# 方式 1：自动探测公网 IP（推荐）
bash /opt/fiber-charge-sim/deploy/setup.sh you@example.com

# 方式 2：手动指定 IP（多网卡 / 自动探测不准时）
bash /opt/fiber-charge-sim/deploy/setup.sh 54.180.28.237 you@example.com
```

这一步会：
- 把 systemd unit 装进 `/etc/systemd/system/`
- 把 Caddyfile 装进 `/etc/caddy/Caddyfile` 并重启 Caddy（自动签 Let's Encrypt 证书）
- 创建 `/opt/fiber-charge-sim/.env`（自动填好域名）
- `npm ci && npm run build`
- enable 所有服务（不会立刻 start）

## 5. 启动节点 + 开通道（首次部署）

```bash
# Router 必须先起
systemctl start fiber-router
sleep 5

# 4 个 Station
systemctl start fiber-station@tesla fiber-station@nio fiber-station@xpeng fiber-station@ea
sleep 5

# WS 代理
systemctl start fiber-ws-proxy

# 一次性：开通道（耗时 ~1 分钟，等通道上链）
cd /opt/fiber-charge-sim/fiber-nodes
./setup-channels.sh
```

## 6. 把 Router pubkey 和通道 outpoint 填回 .env

```bash
# Router pubkey
./fiber-nodes/fnn-cli -u http://127.0.0.1:8227 info | grep pubkey

# 通道 outpoint
./fiber-nodes/fnn-cli -u http://127.0.0.1:8227 list_channels '[{}]'
```

把得到的值填进 `/opt/fiber-charge-sim/.env` 里：

```
NEXT_PUBLIC_ROUTER_PUBKEY=0x<router pubkey>
NEXT_PUBLIC_ROUTER_WS_ADDRESS=/dns4/<域名>/tcp/8231/wss/p2p/<router pubkey 不带 0x>
ROUTER_PUBKEY=<router pubkey 不带 0x>
STATION_1_CHANNEL_OUTPOINT=0x...
STATION_2_CHANNEL_OUTPOINT=0x...
STATION_3_CHANNEL_OUTPOINT=0x...
STATION_4_CHANNEL_OUTPOINT=0x...
```

## 7. 启动前端

```bash
systemctl start fiber-charge-app
```

打开浏览器访问：

```
https://<你的VPS-IP用横杠>.sslip.io
```

第一次打开 Caddy 会去 Let's Encrypt 签证书，可能要 5–15 秒。

---

## 日常运维

### 查看日志
```bash
journalctl -u fiber-router       -f
journalctl -u fiber-station@tesla -f
journalctl -u fiber-charge-app   -f
journalctl -u caddy              -f
```

### 状态
```bash
systemctl status fiber-router fiber-station@tesla fiber-charge-app
```

### 重启
```bash
# 只重启前端（最常见，改完代码后）
bash /opt/fiber-charge-sim/deploy/update.sh

# 或手动
systemctl restart fiber-charge-app

# 重启某个节点
systemctl restart fiber-station@tesla

# ⚠️ 重启 Router 会暂时打断所有支付，谨慎
systemctl restart fiber-router
```

### 备份
SQLite + RocksDB 都在项目目录里，整体打包就行：

```bash
systemctl stop fiber-charge-app   # 仅停前端，避免写入中
tar czf backup-$(date +%F).tgz \
    /opt/fiber-charge-sim/data \
    /opt/fiber-charge-sim/fiber-nodes/data \
    /opt/fiber-charge-sim/.env \
    /opt/fiber-charge-sim/fiber-nodes/.env
systemctl start fiber-charge-app
```

---

## 端口分配速查

| 端口 | 用途 | 是否对外 |
|---|---|---|
| 22 | SSH | ✅ |
| 80 | Caddy HTTP→HTTPS 跳转 + ACME 校验 | ✅ |
| 443 | Caddy HTTPS → Next.js | ✅ |
| 8231 | Caddy TLS → websocat（wss） | ✅ |
| 18231 | websocat（loopback） | ❌ |
| 3000 | Next.js（loopback） | ❌ |
| 8227 / 8228 | Router RPC / P2P | ❌ |
| 8237/47/57/67 | Station RPC | ❌ |
| 8238/48/58/68 | Station P2P | ❌ |

---

## 常见坑

1. **WASM 启动失败 / SharedArrayBuffer is not defined**
   说明 COOP/COEP 头没生效或不在 secure context。检查浏览器一定是从 `https://` 进来的，不是 `http://`。

2. **wss 连不上**
   - Caddy 还在签证书，等 30 秒重试
   - `journalctl -u caddy -n 100` 看证书签发日志
   - 8231 端口防火墙是否放行：`ufw status`

3. **Router 启动失败 "address already in use"**
   旧的 fnn 进程没退干净：`pkill -INT fnn` 后重启

4. **better-sqlite3 编译失败**
   缺 build-essential 或 python3：`apt-get install -y build-essential python3`

5. **域名 sslip.io 解析超慢**
   极少数 DNS 服务器对 sslip.io 解析慢，可换成 `1.2.3.4.sslip.io`（点号形式）或换 `nip.io`
