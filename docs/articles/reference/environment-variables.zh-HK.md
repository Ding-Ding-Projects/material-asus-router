---
title: 環境變數同選項
summary: 可以傳俾容器、compose、host.bat 同設定 script 嘅每一項設定。
---

一共有三層：**伺服器**喺容器入面讀嘅變數、**compose.yaml** 由 `.env` 讀嘅變數，同 **script** 嘅選項。

## 伺服器（容器入面）

| 變數 | 預設 | 意思 |
| --- | --- | --- |
| `DATA_DIR` | `./data`（映像入面係 `/data`） | 儲存帳戶、保險庫同紀錄嘅位置 |
| `PORT` | `8790` | 伺服器喺容器入面監聽嘅端口 |
| `BIND_ADDRESS` | `0.0.0.0` | 監聽嘅地址。設做 `127.0.0.1` 就只接受本機連線 |
| `DEMO` | 未設定 | `1` 會啟動並預先設定模擬路由器 |
| `NODE_ENV` | 映像入面係 `production` | 標準 Node.js 模式 |
| `APP_VERSION` | 建置時設定 | `/health` 顯示嘅版本 |
| `SOURCE_REVISION` | 建置時設定 | 建置嘅原始碼修訂 |
| `BUILD_DATE` | 建置時設定 | 建置時間 |

由原始碼行嘅話，`node server/index.mjs --demo` 等如 `DEMO=1`。

> [!NOTE]
> 改容器入面嘅 `PORT` 唔會改公開端口。容器健康檢查同 `compose.yaml` 嘅端口對應都用 8790。想改主機端口，用下面嘅 `ROUTER_APP_PORT`。

## compose.yaml（由 `.env` 或 shell 讀取）

| 變數 | 預設 | 意思 |
| --- | --- | --- |
| `ROUTER_APP_PORT` | `8790` | 主機端口 |
| `ROUTER_APP_TAG` | `latest` | 要運行嘅映像標籤 |
| `ROUTER_APP_DEMO` | `0` | `1` 會將 `DEMO=1` 傳俾容器 |

`.env` 例子（只係例子，唔係來自你嘅系統）：

```
ROUTER_APP_PORT=8790
ROUTER_APP_TAG=latest
ROUTER_APP_DEMO=0
```

## host.bat 同 scripts\host.ps1

| 選項 | 意思 |
| --- | --- |
| `--detached` | 背景啟動並返回 |
| `--logs` | 啟動並顯示即時狀態同日誌 |
| `--stop` | 停止 app，保留資料 |
| `--remote user@host` | 經 SSH 用 Docker 主機 |
| `--port N` | 主機端口，預設 8790 |
| `--tag X` | 映像標籤，預設 `latest` |
| `--skip-pull` | 用主機上已有嘅映像 |
| `--demo` | 用模擬路由器 |

冇模式選項嘅話，`host.bat` 會顯示選單。最近嘅遠端目標會記喺你部電腦嘅 `%LOCALAPPDATA%\MaterialAsusRouter\last-remote.txt`。

結束碼：`0` 成功、`1` 帶 `Failed:` 訊息嘅失敗、`2` 不明選項。

## scripts\setup.ps1

| 參數 | 意思 |
| --- | --- |
| `-NonInteractive` | 唔問問題 |
| `-Port N` | 主機端口 |
| `-Tag X` | 映像標籤 |
| `-Demo` | 用模擬路由器 |
| `-Remote user@host` | 喺經 SSH 嘅 Docker 主機啟動 |

佢將 `ROUTER_APP_PORT`、`ROUTER_APP_TAG` 同 `ROUTER_APP_DEMO` 寫入 `.env`，其他行會保留。佢從來唔會問路由器登入資料。

## 唔係設定嘅嘢

路由器登入資料、路由器地址同計時還原長度**唔係**環境變數。佢哋係喺 app 輸入，儲存喺資料卷。計時還原長度係 app 入面嘅設定，範圍 20 至 600 秒，預設 90。

另見[安裝](../setup/install.md)同 [Docker 映像同 Compose](../delivery/docker-image.md)。
