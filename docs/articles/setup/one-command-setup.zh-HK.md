---
title: 一鍵設定
summary: 喺終端機選單答幾條問題，由設定 script 寫好設定並啟動 app。
---

`scripts/setup.ps1` 係由新 clone 到 app 行起身最短嘅路。佢只會問自己揀唔到嘅嘢，其餘自動決定，寫一個 `.env` 檔，用 `host.ps1` 啟動 app，再印出可以用嘅連結。

## 點行

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

## 會問嘅問題

互動選單用方向鍵移動、**Enter** 確認、**Backspace** 返回。如果輸入被重新導向，就轉用編號行。

1. **真路由器定模擬路由器。**揀*我嘅真 Asus 路由器*或*模擬路由器（示範）*。
2. **端口。**建議值係由 8790 起計第一個空閒端口。輸入 1024 至 65535 嘅數字。
3. **覆核。**Script 列出 `ROUTER_APP_PORT`、`ROUTER_APP_TAG` 同 `ROUTER_APP_DEMO`。揀*啟動 app*，或者返去改。

> [!IMPORTANT]
> 設定 script 從來唔會問你路由器密碼。路由器登入資料只喺 app 自己嘅設定畫面輸入，見[連接路由器](connect-router.md)。

## 會寫入咩

倉庫根目錄一個 `.env` 檔：

| 鍵 | 意思 | 預設 |
| --- | --- | --- |
| `ROUTER_APP_PORT` | 主機公開端口 | 由 8790 起第一個空閒端口 |
| `ROUTER_APP_TAG` | 映像版本 | `latest` |
| `ROUTER_APP_DEMO` | `1` 代表模擬路由器 | `0` |

你自己加落 `.env` 嘅行會保留。再行一次 script 就可以重新設定，上次嘅值會變成新預設。

## 非互動用法

俾 script 同自動化用，跳過問題：

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -NonInteractive -Port 8790 -Tag latest
```

| 參數 | 意思 |
| --- | --- |
| `-NonInteractive` | 唔問任何嘢，用參數、已儲存嘅值同預設。 |
| `-Port 8790` | 主機端口。 |
| `-Tag 0.1.0` | 映像版本。 |
| `-Demo` | 用模擬路由器。 |
| `-Remote user@host` | 經 SSH 喺 Docker 主機啟動，見[遠端 Docker 主機](remote-docker.md)。 |

## 完成之後

Script 會經 `host.ps1 --detached` 喺背景啟動 app，等健康檢查通過，再印出 `Open: http://<地址>:<端口>/`。開嗰條連結，然後[建立擁有者帳戶](first-owner-account.md)。

如果佢以 `Failed:` 加原因停低，嗰啲原因同解決方法都喺[疑難排解](troubleshooting.md)有列。
