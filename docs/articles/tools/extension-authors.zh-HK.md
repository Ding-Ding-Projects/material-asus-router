---
title: 寫一個擴充功能
summary: 點樣用任何語言寫擴充功能：清單、JSON 行協定、權限同可以行嘅範例。
---

擴充功能係一個細細嘅獨立程式，用嚟幫 Material Asus Router 加功能。程式會啟動佢、經標準輸入同輸出同佢溝通、回答佢關於路由器嘅問題，然後停止佢。因為溝通用嘅係純 JSON 行，所以任何讀寫得文字嘅語言都寫得。

> [!NOTE]
> 擴充功能管理喺**擴充功能**畫面。內置咗兩個：運行時間記錄同排程重啟規劃。由檔案安裝擴充功能仍然**開發中**：而家淨係行得內置嗰兩個。下面嘅清單檢查、權限同協定係真嘅，內置嗰兩個都係用同一套。

## 清單

每個擴充功能都有一份清單，係一個 JSON 物件，欄位就係下面呢啲。

```json
{
  "schema": 1,
  "id": "uptime-log",
  "version": "1.0.0",
  "entry": "uptime-log.mjs",
  "name": { "en": "Uptime log", "yue": "運行時間記錄" },
  "description": { "en": "Reads how long the router has been running.", "yue": "讀取路由器已經運行咗幾耐。" },
  "permissions": ["router.status"],
  "author": "Pat"
}
```

清單檢查會拒絕：`schema` 錯、`id` 唔係細楷字母數字同橫線、`version` 唔似 `1.0.0`、`entry` 帶有資料夾、缺少英文或者粵語文字、重複或者未知嘅權限，或者有佢唔認識嘅欄位。

## 權限

| 權限 | 容許擴充功能做乜 |
| --- | --- |
| `router.status` | 讀取路由器已經運行咗幾耐。 |
| `nvram.read` | 讀取一般路由器設定。任何似密碼、金鑰、token 或者機密嘅設定，就算有呢個權限都唔會俾。 |

SSH 憑證、路由器密碼同寫入權限完全冇對應嘅權限。清單要求 `ssh.credentials`、`router.password`、`vault.read`、`nvram.secrets`、`nvram.write` 或者 `router.exec` 會直接被拒絕。

擴充功能要求嘅每個權限，都要使用者允許咗先會執行。程式會連同你睇過嘅權限版本一齊記住你嘅選擇，所以更新之後如果佢要求更多，就會再問你。

## 協定

程式啟動你嘅程式後，會喺標準輸入送一行。

```json
{"hello":{"api":1,"permissions":["router.status"]}}
```

之後你嘅程式可以送請求，每行一個 JSON 物件，都帶一個數字 `id`。

```json
{"id":1,"call":"router.uptime"}
{"id":2,"call":"nvram.get","key":"productid"}
```

程式會用同一個 `id` 回答。

```json
{"id":1,"ok":true,"value":{"seconds":86400}}
{"id":2,"ok":false,"error":"permission-denied"}
```

做完之後，送一行結果然後結束。結果可以係任何 JSON。

```json
{"result":{"days":1}}
```

## 限制

擴充功能最多行 5 秒、最多寫 64 KiB、最多發 20 個請求。佢攞到嘅環境係空嘅，睇唔到程式任何變數。如果超出限制、送咗唔係 JSON 嘅嘢，或者冇結果就結束，程式會停止佢並顯示原因。

## JavaScript 範例

```js
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.hello) process.stdout.write(JSON.stringify({ id: 1, call: "router.uptime" }) + "\n");
  else if (msg.id === 1) process.stdout.write(JSON.stringify({ result: { days: Math.floor(msg.value.seconds / 86400) } }) + "\n");
});
```

## Python 範例

```python
import json, sys

for line in sys.stdin:
    msg = json.loads(line)
    if "hello" in msg:
        print(json.dumps({"id": 1, "call": "router.uptime"}), flush=True)
    elif msg.get("id") == 1:
        print(json.dumps({"result": {"days": msg["value"]["seconds"] // 86400}}), flush=True)
        break
```

## 要知道

擴充功能而家只可以讀取：佢可以要求嘅嘢，冇一樣會改動路由器。將來加入寫入權限嗰陣，會同其他改動一樣經過預覽、安全機制同還原。
