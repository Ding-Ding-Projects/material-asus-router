---
title: 發佈同驗證
summary: 版本點樣發佈，以及點樣確認你行緊嘅映像就係你想要嗰個。
---

> [!NOTE]
> **進行中。**映像 workflow 已經存在，網站同 PDF 由佢哋自己嘅 workflow 建置。本指南講嘅係預計嘅發佈流程。仲欠嘅係：第一個已發佈同檢查過嘅版本可以連結。依賴某個標籤之前，請先睇倉庫嘅 Releases 頁同套件頁。

## 發佈係咩

一個發佈包括 `package.json` 嘅版本號、`ghcr.io` 上對應嘅映像，同發佈說明。每當 main 分支有改動伺服器、頁面、依賴或 Dockerfile 嘅推送，映像 workflow 就會運行，亦可以手動運行。每次運行都為 `linux/amd64` 同 `linux/arm64` 建置，並發佈三個標籤：版本號、`sha-<12 個字元>` 同 `latest`。

## 揀要行嘅版本

| 你想 | 用標籤 |
| --- | --- |
| 最新建置 | `latest` |
| 可預期嘅更新 | 版本號，例如 `0.1.0` |
| 清楚知係邊個原始碼 | `sha-<12 個字元>` |

`host.bat --tag 0.1.0` 或者 `.env` 入面嘅 `ROUTER_APP_TAG=0.1.0` 就會揀佢。

## 驗證你行緊嘅映像

1. 拉取：`docker pull ghcr.io/ding-ding-projects/material-asus-router:0.1.0`。
2. 讀佢嘅標籤：

```
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' ghcr.io/ding-ding-projects/material-asus-router:0.1.0
```

3. 將修訂同你預期嘅倉庫 commit 比較。一致就代表映像由嗰份原始碼建置。
4. 問運行中嘅 app：開 `/health` 睇版本。回應例子（只係例子，唔係來自你嘅系統）：`{"ok":true,"version":"0.1.0","router":"none"}`。

`host.bat` 成功嗰陣亦會印出 app 版本。

## 驗證說明網站

說明網站係用 `node scripts/build-site.mjs site` 由 `docs/` 入面嘅 Markdown 建置。如果有壞連結、不明嘅相關 slug，或者未列入證據清單嘅圖片，建置會失敗，所以發佈咗嘅每一頁都通過咗呢啲檢查。裝咗 Chrome 或 Edge 嘅話，可以用 `node scripts/build-pdf.mjs site` 產生同一內容嘅手機尺寸 PDF。

## 指南入面「已完成」嘅意思

只有功能已建置並檢查過，指南先會標示**已完成**。**進行中**嘅指南會寫明欠咩。發佈版本唔會改變呢點：有版本號唔代表列出嘅範圍就可以用，請睇每個範圍嘅狀態標籤。

## 報告問題

開 issue 並附上 `/health` 嘅版本、映像標籤、你嘅韌體類型（原廠或 Merlin）同確切訊息。唔想公開嘅地址請移除，亦千祈唔好附上密碼、備份或金鑰。安全問題請跟倉庫嘅 `SECURITY.md`。

## 相關

[Docker 映像同 Compose](docker-image.md)、[更新 app](../setup/updating.md)、[Windows 桌面版](desktop-app.md)。
