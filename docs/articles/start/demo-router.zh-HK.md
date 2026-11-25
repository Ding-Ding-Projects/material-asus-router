---
title: 試用示範路由器
summary: 用內置嘅模擬路由器試晒成個 app，唔使真係有 Asus 路由器。
---

示範模式會喺 app 入面開一部**模擬 Asus 路由器**。佢會講 SSH，用記憶體入面一張設定表，回應 app 通常送俾真路由器嘅同一批指令。你可以逐個畫面睇、做改動、還原、加人，完全唔會掂到真設備。

> [!IMPORTANT]
> 示範模式見到嘅所有嘢都係模擬路由器提供，唔係你網絡嘅真實資料，請當佢係例子。你做嘅改動唔會送去任何地方，app 重啟就冇晒。

## 點樣啟動

### 用 host.bat

```
host.bat --demo
```

可以照常加 `--detached` 或 `--logs`，例如 `host.bat --detached --demo`。見[安裝](../setup/install.md)。

### 用一鍵設定

第一條問題揀**模擬路由器（示範）**，或者加 `-Demo`：

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -Demo
```

### 直接用 Docker Compose

```
ROUTER_APP_DEMO=1 docker compose up -d
```

喺 Windows PowerShell 要先打 `$env:ROUTER_APP_DEMO = '1'`。

### 唔用 Docker

喺原始碼目錄行 `node server/index.mjs --demo`，或者設定 `DEMO=1`。

## 示範模式做啲咩

- 喺內部地址建立一部模擬路由器，並**預先設定好連線**（包括主機金鑰），所以你可以跳過連接步驟。
- 預設係 Merlin 版本，所以你睇到啟用咗嘅 Merlin 專屬控制項。同一部模擬路由器亦可以扮原廠韌體，測試「停用並講明原因」嘅行為就係咁做。見[韌體偵測](../setup/firmware-detection.md)。
- 照樣要你建立第一個帳戶（即係擁有者），所以你都可以試角色。

## 做唔到嘅嘢

| 唔會 | 原因 |
| --- | --- |
| 反映你真實嘅網絡 | 模擬路由器有自己虛構嘅裝置同設定。 |
| 重啟後保留改動 | 模擬設定表淨係存喺記憶體。 |
| 證明你部路由器會一模一樣 | 唔同型號同版本嘅真韌體會有差異。 |

## 建議嘅第一次體驗

1. 建立擁有者帳戶。
2. 打開**總覽**，留意型號同韌體類型。
3. 打開 **Wi-Fi**，改網絡名稱，預覽、確認、套用。
4. 打開改動紀錄，還原嗰次改動。
5. 喺人員畫面加一個檢視者，用私密視窗以檢視者登入，留意任何改動都會被拒絕。

## 轉用真路由器

停低示範，再行[一鍵設定](../setup/one-command-setup.md)，揀**我嘅真 Asus 路由器**，然後跟[連接路由器](../setup/connect-router.md)。除非你刪咗資料卷，否則示範用嘅帳戶同紀錄會留低，見[備份資料卷](../setup/backing-up-data.md)。
