---
title: 用 Docker 同 host.bat 安裝
summary: 用 host.bat 喺你部電腦行已發佈嘅映像，可以背景運行，或者睇即時日誌。
---

呢個 app 以 Docker 映像形式發佈。倉庫根目錄嘅 `host.bat` 會拉取映像、用倉庫入面嘅 `compose.yaml` 啟動、等健康檢查通過，再印出要開嘅地址。除咗 Docker，唔使裝其他嘢。

## 開始之前

| 需要 | 備註 |
| --- | --- |
| 有 Compose 嘅 Docker | Windows 或 macOS 用 Docker Desktop，Linux 用 Docker Engine 加 Compose 外掛。必須已經行緊。 |
| 倉庫嘅副本 | Clone 或者下載都得。Script 會用旁邊嘅 `compose.yaml`。 |
| 一個空閒端口 | 預設 `8790`。 |

## 點行

1. 喺倉庫資料夾開一個終端機。
2. 唔加任何選項行 `host.bat` 就會出鍵盤選單，或者用下面嘅選項。
3. 等到綠色一行話 app 運行緊，然後開 `Open:` 後面嘅地址。

Script 會檢查 `docker` 存唔存在、Compose 得唔得、Docker 伺服器有冇回應。之後拉取映像、啟動、最多等 90 秒等容器報告健康，再由呢部電腦攞印出嚟嘅地址嘅 `/health`，證明連得到。

### 兩種模式

| 選項 | 做啲咩 |
| --- | --- |
| `host.bat --detached` | 背景啟動，報告健康狀態同地址後就返回。 |
| `host.bat --logs` | 啟動後顯示即時狀態同日誌。**F** 暫停或繼續跟隨，**S** 切換服務，**R** 重新整理狀態行，**Q** 或 Esc 離開。離開唔會停止 app。 |
| `host.bat --stop` | 停止 app。設定、加密保險庫同改動紀錄都留喺資料卷。 |

雙擊 `host.bat` 會出選單：先揀喺邊度行（呢部電腦、上次嘅 SSH 目標，或者另一部主機），再揀背景啟動、啟動並睇日誌、停止或者離開。

### 其他選項

| 選項 | 意思 |
| --- | --- |
| `--port 8790` | 主機端口。 |
| `--tag 0.1.0` | 要拉取嘅映像版本，預設係 `latest`。 |
| `--demo` | 用[內置模擬路由器](../start/demo-router.md)。 |
| `--remote user@host` | 經 SSH 喺另一部 Docker 主機行，見[遠端 Docker 主機](remote-docker.md)。 |
| `--skip-pull` | 用主機上已有嘅映像，唔拉取。 |

## 地址係咩樣

Script 會印出呢部電腦喺區域網絡嘅地址，例如 `http://198.51.100.5:8790/`。同網絡嘅任何裝置都可以開。呢個 app 係俾你自己嘅網絡用，唔好將個端口開放上互聯網。見[資料同安全模型](../reference/security-model.md)。

## 喺家用網絡有自己嘅地址

除咗用 Docker 主機上面嘅端口，個 app 亦可以喺你嘅網絡有自己嘅地址，例如 `http://198.51.100.50:8790/`。用 `host.bat --lan-ip 198.51.100.50` 啟動，詳情見[畀個 app 喺家用網絡有自己嘅地址](own-address.md)。預設仍然係發佈端口。

## compose.yaml 設定咗啲咩

- 映像 `ghcr.io/ding-ding-projects/material-asus-router`，標籤取自 `ROUTER_APP_TAG`。
- 主機公開端口 `8790`（用 `ROUTER_APP_PORT` 改）。
- 名為 `router-data` 嘅資料卷，掛載喺 `/data`。
- 唯讀根檔案系統、冇額外 Linux 權能、`no-new-privileges`，仲有健康檢查。

詳情見 [Docker 映像同 Compose](../delivery/docker-image.md)。

## 下一步

[建立擁有者帳戶](first-owner-account.md)，再[連接路由器](connect-router.md)。出事嘅話睇[疑難排解](troubleshooting.md)。
