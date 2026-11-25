---
title: Docker 映像同 Compose
summary: 已發佈映像入面有啲咩、compose.yaml 點樣運行佢，以及佢點樣加固。
---

> [!NOTE]
> 建置同發佈映像嘅 workflow 喺倉庫入面。本指南講映像同 Compose 檔點樣設定。你睇緊呢篇嗰陣某個標籤有冇真係發佈，要用 `docker pull` 確認，見[發佈同驗證](releases.md)。呢度仲欠嘅係：一個經過檢查、已發佈嘅版本可以指向。

## 映像

`ghcr.io/ding-ding-projects/material-asus-router`

| 項目 | 內容 |
| --- | --- |
| 基底 | `node:24.22.1-bookworm-slim`，用 digest 固定 |
| 平台 | `linux/amd64` 同 `linux/arm64`（所以 Raspberry Pi 級主機都行到） |
| 端口 | `8790` |
| 用戶 | 非 root 嘅 `node` |
| 資料 | 掛載喺 `/data` 嘅資料卷 |
| 入口 | `node server/index.mjs` |
| 依賴 | 用 `npm ci --omit=dev --ignore-scripts` 安裝 |

映像只包含伺服器同建置好嘅靜態頁面，裏面冇任何路由器登入資料。登入資料之後先喺資料卷入面產生。

### 標籤

| 標籤 | 意思 |
| --- | --- |
| `latest` | main 分支最新嘅建置 |
| `0.1.0`（即 `package.json` 嘅版本） | 指定版本 |
| `sha-<12 個字元>` | 精確嘅原始碼修訂 |

映像帶有標準標籤：標題、描述、來源、授權（MIT）、修訂、建立日期同版本。

## compose.yaml

倉庫入面嘅 `compose.yaml` 運行一個叫 `asus-router` 嘅服務。

| 設定 | 作用 |
| --- | --- |
| `image` | `ghcr.io/ding-ding-projects/material-asus-router:${ROUTER_APP_TAG:-latest}` |
| `ports` | `${ROUTER_APP_PORT:-8790}:8790` |
| `environment: DEMO` | `${ROUTER_APP_DEMO:-0}`；`1` 會啟動[模擬路由器](../start/demo-router.md) |
| `volumes` | 名為 `router-data` 嘅資料卷，掛載喺 `/data` |
| `restart` | `unless-stopped` |
| `stop_grace_period` | 20 秒，等進行緊嘅寫入完成 |
| `read_only` | 根檔案系統唯讀；`/tmp` 係記憶體檔案系統 |
| `cap_drop` | 移除 `ALL` 所有 Linux 權能 |
| `security_opt` | `no-new-privileges:true` |
| `healthcheck` | 每 30 秒攞一次 `/health`，逾時 5 秒，重試 3 次 |

[一鍵設定](../setup/one-command-setup.md)寫嘅 `.env` 會提供 `ROUTER_APP_PORT`、`ROUTER_APP_TAG` 同 `ROUTER_APP_DEMO`。

## 唔用 host.bat

```
docker compose pull
docker compose up -d
docker compose logs -f asus-router
docker compose stop
```

`host.bat` 喺呢啲指令之上加咗檢查同清楚嘅地址。見[安裝](../setup/install.md)。

## 健康端點

`GET /health` 唔使登入，回傳版本同粗略嘅路由器狀態（`none`、`configured` 或 `connected`），永遠唔會傳回登入資料。見 [API 概覽](../reference/api.md)。

## 網絡

容器只需要經 TCP 連去路由器嘅 SSH 端口，其他都唔使。只喺可信任嘅網絡公開個端口。見[資料同安全模型](../reference/security-model.md)。

## 自己建置

```
docker build -t material-asus-router --build-arg APP_VERSION=0.1.0 .
```

用你建置嘅名稱配合 `ROUTER_APP_TAG` 或 `--tag`，再喺 `host.bat` 加 `--skip-pull`，就可以行本機建置。
