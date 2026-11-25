---
title: 備份資料卷
summary: 複製同還原載有帳戶、加密保險庫同改動紀錄嘅資料卷。
---

app 記住嘅一切都喺一個掛載於 `/data` 嘅 Docker 資料卷。本指南備份嘅係 **app 自己嘅資料**。想備份路由器設定，見[備份同還原](../router/backup-restore.md)，兩者係唔同嘅嘢。

## 資料卷有啲咩

| 檔案 | 內容 |
| --- | --- |
| `state.json` | 帳戶（只有密碼雜湊）、已儲存嘅路由器連線（唔包括密碼）、設定、改動紀錄 |
| `vault.json` | 路由器密碼同 app 嘅 SSH 私鑰，各自加密 |
| `vault.key` | 保險庫用嘅隨機 AES-256-GCM 金鑰，權限 0600 |

> [!WARNING]
> `vault.key` 同 `vault.json` 一齊就可以解鎖已儲存嘅路由器登入資料。資料卷備份要當密碼咁處理：放喺私人同加密嘅地方，唔好放共用磁碟。

## 搵資料卷名

Compose 會用專案名（預設係資料夾名）做前綴。

```
docker volume ls
```

搵一個以 `router-data` 結尾嘅名，例如 `material-asus-router_router-data`。下面請用你自己嘅名。

## 備份

先停 app，確保冇寫入進行中，再將資料卷複製成目前資料夾入面嘅 `.tar.gz` 檔。

```
host.bat --stop
docker run --rm -v material-asus-router_router-data:/data:ro -v "$PWD":/backup alpine tar czf /backup/router-data-backup.tar.gz -C /data .
host.bat --detached
```

喺 Windows PowerShell 將 `"$PWD"` 改成 `"${PWD}"`。成功之後你嘅資料夾會多咗 `router-data-backup.tar.gz`，指令本身唔會印任何嘢。

遠端 Docker 主機嘅話，喺嗰部主機行呢啲指令，或者先將 `DOCKER_HOST` 設成 SSH 目標。

## 還原

1. 停 app：`host.bat --stop`。
2. 將備份檔放喺目前資料夾。
3. 還原入資料卷。呢步會**取代**入面嘅內容。

```
docker run --rm -v material-asus-router_router-data:/data -v "$PWD":/backup alpine sh -c "rm -rf /data/* /data/.[!.]* ; tar xzf /backup/router-data-backup.tar.gz -C /data"
```

4. 再啟動 app，用備份當時已經存在嘅帳戶登入。

檔案必須屬於 app 運行時嘅用戶（`node`，用戶 ID 1000）。如果還原後 app 報告資料檔損毀或者讀唔到，喺輔助容器入面行 `chown -R 1000:1000 /data`。

## 用空嘅資料卷重新開始

呢個做法會刪除帳戶、保險庫同紀錄。

```
host.bat --stop
docker compose down -v
```

## 幾耐備份一次

改咗帳戶或者連接新路由器之後，同每次[更新](updating.md)之前都備份。紀錄好細，頻密備份好平。
