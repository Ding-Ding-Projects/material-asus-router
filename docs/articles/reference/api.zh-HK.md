---
title: API 概覽
summary: App 提供嘅每條 HTTP 路由、邊個可以呼叫，以及請求點樣受保護。
---

網頁透過一個細嘅 JSON API 同伺服器溝通。佢係俾 app 自己嘅頁面用，唔係公開整合介面，所以路由可能隨版本改變。呢度列出今日有嘅路由。

## 慣例

- 除非另有說明，請求同回應都係 JSON。超過 1 MiB 嘅請求會被拒絕，訊息係 `That request is too large.`；還原路由容許最多 6 MiB。
- 錯誤會回傳帶有易讀 `error` 訊息、有時有 `code` 嘅 JSON 物件，並配對應嘅 HTTP 狀態碼。
- 登入會設定 `HttpOnly`、`SameSite=Strict` 嘅階段 cookie，有效 8 小時。
- 每個會改嘢嘅請求（除咗 `GET` 同 `HEAD`）都要喺 `X-CSRF` 標頭送出階段權杖。權杖來自 `/api/session` 或登入回應。權杖錯或者冇，會回傳 403 同 code `CSRF`。
- 角色：**O** 只限擁有者、**W** 擁有者同操作員、**R** 每個已登入角色、**P** 公開（唔使登入）。

## 公開路由

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `GET /health` | P | 版本同粗略嘅路由器狀態，Docker 健康檢查用 |
| `GET /api/session` | P | 需唔需要設定、有冇登入、你嘅角色、CSRF 權杖、路由器狀態 |
| `POST /api/setup` | P | 建立擁有者，只可以做一次。需要 `username`、`password`，`name` 選填 |
| `POST /api/login` | P | 用 `username` 同 `password` 登入。按地址限制次數 |

`GET /health` 回應例子（只係例子，唔係來自你嘅系統）：

```json
{ "ok": true, "version": "0.1.0", "router": "connected" }
```

## 階段

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `POST /api/logout` | R | 結束階段 |

## 人員

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `GET /api/users` | O | 擁有者同其他人，不含任何密碼資料 |
| `POST /api/users` | O | 加操作員或檢視者 |
| `PATCH /api/users/:id` | O | 改 `role`、`name` 或 `password`。改角色或密碼會結束嗰個人嘅階段 |
| `DELETE /api/users/:id` | O | 移除一個人並結束佢嘅階段 |

## 路由器連線

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `GET /api/router` | R | 連線概覽：地址、端口、用戶、方式、韌體、已固定嘅主機金鑰、示範標記。永遠唔會有密碼 |
| `POST /api/router/connect` | O | 用 `host`、`port`、`username`、`authType`（`key` 或 `password`）、`password` 連接。可能回 409 並附上要批准嘅主機金鑰 |
| `POST /api/router/approve-host-key` | O | 喺 5 分鐘內批准等候中嘅指紋 |
| `POST /api/router/key` | O | 產生 app 嘅 SSH 金鑰並回傳公鑰。更換使用中嘅金鑰要 `replace: true` |
| `POST /api/router/forget` | O | 移除已儲存嘅連線同密碼 |

## 讀取路由器資料

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `GET /api/catalog` | R | 路由器資訊、範圍清單，同每項已知設定嘅友善名稱同現值 |
| `GET /api/domain/:id` | R | 一個範圍嘅資料。總覽、裝置同進階一定讀即時資料。`history` 回傳改動紀錄 |
| `GET /api/logs` | R | 路由器日誌，可帶查詢選項 |
| `POST /api/reveal` | W | 按 `id` 或 `key` 回傳一項機密設定（例如 Wi-Fi 密碼）嘅值 |

> [!WARNING]
> `POST /api/reveal` 會向擁有者同操作員回傳明文機密，佢哋本身已經可以改路由器。檢視者會被拒絕，因為檢視者嘅請求只限讀取同預覽。其他地方（清單同備份）機密都會被遮住。

## 安全改動

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `POST /api/changes/preview` | R | 將一串改動變成列出舊值同新值嘅預覽，唔會改任何嘢 |
| `POST /api/changes/apply` | W | 按 `previewId` 套用預覽。預覽會過期。`verifyHost` 選填 |
| `GET /api/changes/history` | R | 紀錄 |
| `GET /api/changes/history/:id` | R | 單一紀錄 |
| `POST /api/changes/:id/undo` | W | 還原已套用嘅改動：將儲起嘅舊值當新改動套用 |
| `GET /api/settings` | R | 讀取計時還原長度 `guardSeconds` |
| `POST /api/settings` | W | 將 `guardSeconds` 設定為 20 至 600（預設 90） |

## 動作

`POST /api/actions/:name` 執行一個動作。名稱：`ping`、`traceroute`、`nslookup`、`wake`、`restart-service`、`reboot`、`install-key`。

| 動作 | 角色 | 備註 |
| --- | --- | --- |
| `ping`、`traceroute`、`nslookup` | W | 網絡工具，見[網絡工具](../tools/network-tools.md) |
| `wake` | W | 對一個 MAC 地址做網絡喚醒 |
| `restart-service` | W | 只限 app 白名單入面嘅服務 |
| `reboot` | W | 雙重確認：`confirm` 要填完全一樣嘅路由器型號，同埋 `hold: true`。否則回 403，code 係 `CONFIRM_MODEL` 或 `CONFIRM_HOLD` |
| `install-key` | O | 回傳一個預覽，將 app 公鑰加入路由器允許嘅金鑰 |

## 備份同還原

| 方法同路徑 | 角色 | 用途 |
| --- | --- | --- |
| `GET /api/backup` | R | 以 JSON 下載路由器設定。機密會遮住。`?secrets=1` 包含機密，只限擁有者 |
| `POST /api/restore` | W | 上載備份。回傳有差異嘅預覽同被跳過嘅設定清單。要套用嗰個預覽之後先會真係改動 |

## 靜態檔案

其他 `GET` 會回傳 app 嘅頁面或資源。冇副檔名嘅未知路徑會回傳主頁，所以深層連結都得。回應帶有嚴格嘅內容安全政策（只容許 app 自己嘅腳本同樣式）同 `X-Frame-Options: DENY`。

## 狀態碼

| 碼 | 意思 |
| --- | --- |
| 400 | 請求無效 |
| 401 | 未登入，或登入資料錯 |
| 403 | 角色被拒、CSRF 權杖錯或欠確認 |
| 404 | 不明路由、設定、動作或紀錄 |
| 409 | 衝突，例如要批准主機金鑰，或者預覽之後設定已改 |
| 410 | 預覽已過期 |
| 413 | 請求太大 |
| 429 | 登入失敗太多次 |
| 502 | 路由器唔接受 app 需要嘅嘢 |
