---
title: 經 SSH 用遠端 Docker 主機
summary: 唔喺自己部電腦行，改喺細型伺服器或 NAS 用 Docker 行呢個 app。
---

你可以喺另一部有 Docker 嘅機器（例如迷你電腦或 NAS）行呢個 app，然後喺自己部電腦管理。`host.bat --remote` 會經 SSH 將 Docker 指去嗰部機器，資料卷亦會留喺遠端主機。

> [!NOTE]
> 呢度其實有兩條 SSH 連線。本指南講第一條：由你部電腦去 Docker 主機。第二條係 app 去路由器，喺[連接路由器](connect-router.md)講。

## Docker 主機嘅要求

- 有 Compose 嘅 Docker，而且行緊。
- 一個可以行 `docker` 指令嘅 SSH 帳戶。
- 由你部電腦用金鑰登入 SSH。`ssh user@host docker info` 必須**唔使輸入密碼**都得，因為 `host.bat` 答唔到密碼提示。
- 主機要同路由器喺同一個網絡，咁 app 先連得到路由器地址。

## 啟動、觀察同停止

將 `pat@198.51.100.5` 換成你自己嘅目標。

```
host.bat --detached --remote pat@198.51.100.5
host.bat --logs --remote pat@198.51.100.5
host.bat --stop --remote pat@198.51.100.5
```

目標必須係 `user@host` 嘅格式。Script 只喺本身運行期間設定 `DOCKER_HOST=ssh://user@host`，所以唔會改你平時嘅 Docker 設定。

用一鍵設定嘅話，加 `-Remote pat@198.51.100.5`。見[一鍵設定](one-command-setup.md)。

### 用選單

唔加選項行 `host.bat`，揀**經 SSH 嘅另一部 Docker 主機**，再輸入目標。最近一次嘅目標只會記喺你部電腦嘅 `%LOCALAPPDATA%\MaterialAsusRouter\last-remote.txt`，唔會入倉庫，下次會提議返俾你。

## 過程

1. Script 檢查遠端主機嘅 Docker。
2. 喺**遠端主機**拉取映像，所以主機要連得到 `ghcr.io`。
3. 喺嗰度啟動容器，等健康檢查。
4. 搵出主機地址，由你部電腦攞 `/health`，然後印出 `Open: http://<主機>:8790/`。

如果主機名唔係 IP 地址，script 會解析成 IPv4 地址再印出。

## 資料喺邊

`router-data` 資料卷喺遠端主機。備份都要喺嗰邊做，見[備份資料卷](backing-up-data.md)。用 `--stop` 停止會保留資料卷。

## 常見問題

| 訊息 | 解決方法 |
| --- | --- |
| `the remote target must look like user@host` | 檢查拼寫，唔好有空格同 `ssh://` 前綴。 |
| `Docker on user@host cannot be reached over SSH` | 自己行 `ssh user@host docker info`。先修好金鑰登入。 |
| `the image could not be pulled` | 遠端主機連唔到 `ghcr.io`，或者 `--tag` 唔存在。 |
| `... does not answer from this computer` | 遠端主機嘅防火牆擋咗個端口。 |

更多見[疑難排解](troubleshooting.md)。
