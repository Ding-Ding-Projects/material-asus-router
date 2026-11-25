---
title: 更新 app
summary: 拉取新映像、重啟容器，同時保留設定、帳戶同紀錄。
---

你嘅設定、帳戶、加密保險庫同改動紀錄都存喺 `router-data` 資料卷，唔係喺容器入面。更新即係用新映像取代容器，資料卷原封不動。

> [!TIP]
> 更新前先複製一份資料卷。見[備份資料卷](backing-up-data.md)。

## 用 host.bat 更新

再行一次 `host.bat`，啟動之前一定會先拉取所揀標籤嘅映像。

```
host.bat --detached
```

- 預設標籤 `latest` 會拉取最新已發佈嘅映像。
- 想固定版本就傳入版本：`host.bat --detached --tag 0.1.0`。想自己決定幾時更新嘅時候，固定版本好有用。
- 遠端 Docker 主機要加 `--remote pat@198.51.100.5`。

映像有變嘅話，script 會重建容器，等健康檢查，再印出地址同運行中嘅版本，例如 `Material Asus Router 0.1.0 is running on this computer.`。

## 用一鍵設定更新

再行 `scripts\setup.ps1`。你上次嘅答案會變成預設，所以可以逐條按 Enter，或者用 `-NonInteractive`。見[一鍵設定](one-command-setup.md)。

## 直接用 Compose 更新

```
docker compose pull
docker compose up -d
```

## 之後要檢查

1. 開地址登入，帳戶應該冇變。
2. 打開總覽，路由器連線應該用已固定嘅主機金鑰自動重新連接。
3. 打開改動紀錄，以前嘅改動同還原掣都仲喺度。

如果第一個畫面又叫你建立擁有者帳戶，即係 app 用咗空嘅資料卷啟動：見[疑難排解](troubleshooting.md)。

## 返去舊版本

將舊標籤傳俾 `--tag`。舊版本可能睇唔明新版本寫入嘅資料，所以舊版本拒絕啟動嘅話，請還原更新前做嘅資料卷備份。

## 自動更新

App 唔會自己更新。如果你用自動更新容器嘅工具，請固定標籤而唔好用 `latest`，咁就唔會喺你改緊嘢嗰陣更新。

版本點發佈同點驗證映像，見[發佈同驗證](../delivery/releases.md)。
