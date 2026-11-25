---
title: 畀個 app 喺家用網絡有自己嘅地址
summary: 用 macvlan 網絡，等行 Docker 嘅 app 喺家用網絡有自己嘅地址，唔再係 Docker 主機上面嘅一個端口。
---

預設做法係用**行緊 Docker 嗰部電腦嘅端口**開個 app，例如 `http://198.51.100.5:8790/`。自己地址模式就唔同：個 app 喺家用網絡有**自己一個地址**，例如 `http://198.51.100.50:8790/`，好似一部獨立嘅細機。其他嘢冇變：同一個映像、同一個資料卷、同樣嘅防護。

背後用 Docker 嘅 **macvlan** 網絡，畀容器喺主機網卡旁邊有自己嘅網絡身份。預設仍然係發佈端口，自己地址係你揀先用。

## 需要啲咩

| 需要 | 備註 |
| --- | --- |
| **Linux** 上面嘅 Docker | 通常係[遠端 Docker 主機](remote-docker.md)，例如迷你電腦或 NAS。Windows 或 macOS 嘅 Docker Desktop 做唔到畀容器網絡地址，script 會直接話你知。 |
| 一個空閒地址 | 家用網絡入面冇其他嘢用緊嘅一個地址。 |
| 網絡資料 | 主機嘅網絡介面（例如 `eth0`）、CIDR 格式嘅網絡（例如 `198.51.100.0/24`），同路由器地址（例如 `198.51.100.1`）。喺 Linux 主機上，script 會幫你查。 |

> [!IMPORTANT]
> 揀一個**喺路由器 DHCP 範圍以外**嘅地址，或者喺路由器入面幫個 app 預留。如果路由器將同一個地址派畀部電話，兩部機爭一個地址，兩邊都會出事。Script 會拒絕已經有回應嘅地址，但睇唔到未用過嘅租約。

## 用 host.bat 啟動

```
host.bat --remote user@host --lan-ip 198.51.100.50
```

| 選項 | 意思 |
| --- | --- |
| `--lan-ip 198.51.100.50` | App 自己嘅地址。開啟自己地址模式。 |
| `--lan-parent eth0` | Docker 主機嘅網絡介面。唔寫就自動查。 |
| `--lan-subnet 198.51.100.0/24` | 家用網絡（CIDR 格式）。唔寫就自動查。 |
| `--lan-gateway 198.51.100.1` | 路由器地址。唔寫就自動查。 |

如果有值冇寫，script 會經同一條 SSH 連線，喺 Docker 主機自己嘅網絡行一個即用即棄嘅輔助容器去查。查唔到嘅話會問你，問唔到就停低同你講。

雙擊 `host.bat` 會出選單：揀完喺邊度行，再揀**用自己嘅地址喺家用網絡**，然後打地址。

### 會檢查啲咩

1. Linux 主機上嘅 Docker 有回應，而且唔係 Docker Desktop。
2. 地址係咪空閒：主機上一個即用即棄嘅容器會 ping 嗰個地址，再睇鄰居表。有回應或者已經知道硬件地址，就唔會啟動。
3. App 啟動，容器報告健康。
4. 由**呢部電腦**攞 `http://198.51.100.50:8790/health`，再印出可以撳嘅地址。

自己地址模式用容器真正嘅 `8790` 端口，`--port` 唔適用。

## 用一鍵設定

`scripts\setup.ps1` 有一步*點樣開個 app？*，選項係*用運行電腦上面嘅端口*同*用自己嘅地址喺家用網絡*。地址欄位會存入 `.env`，下次行嘅時候上次嘅值就係新預設。唔使互動：

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -NonInteractive -Remote user@host -LanIp 198.51.100.50
```

想自己寫網絡資料就加 `-LanParent`、`-LanSubnet` 同 `-LanGateway`，想返去發佈端口就加 `-PublishedPort`。

## 直接用 Compose

`compose.lan.yaml` 係一個覆蓋檔，要同 `compose.yaml` **一齊用**：

```
docker compose -f compose.yaml -f compose.lan.yaml up -d
```

| 變數 | 意思 |
| --- | --- |
| `ROUTER_APP_LAN_PARENT` | 主機嘅網絡介面，例如 `eth0`。 |
| `ROUTER_APP_LAN_SUBNET` | CIDR 格式嘅網絡。 |
| `ROUTER_APP_LAN_GATEWAY` | 路由器地址。 |
| `ROUTER_APP_LAN_IP` | App 自己嘅地址。 |
| `ROUTER_APP_LAN_RANGE` | 可選。限制網絡嘅範圍，預設只係 app 自己嗰個地址（`<地址>/32`），Docker 唔會將呢個網絡嘅地址派畀其他嘢。 |

覆蓋檔會拎走發佈端口，將 app 接去 macvlan 網絡。唯讀根檔案系統、捨棄權限、`no-new-privileges` 同經容器自己 loopback 嘅健康檢查，全部同 `compose.yaml` 一樣。想睇合併結果用 `docker compose -f compose.yaml -f compose.lan.yaml config`。

## 主機接觸唔到自己個容器

呢個係 macvlan 嘅運作方式，唔係壞咗：**行 Docker 嗰部電腦，喺自己嗰張網卡上面接觸唔到 macvlan 容器。**網絡上其他裝置就接觸到。實際上：

- 用你部電話或者另一部電腦開個 app，唔好喺 Docker 主機自己開。
- Docker 主機係遠端機器嘅時候，`host.bat` 喺你部電腦行，檢查到個地址。Docker 主機係**呢部**電腦嘅時候，script 喺度檢查唔到，會照直講，再印出畀其他裝置開嘅地址。
- 真係要由 Docker 主機接觸嘅話，要喺主機加一個 macvlan「shim」介面。呢個係進階網絡設定，唔喺呢個 app 範圍。

## 疑難排解

| 徵狀 | 可能原因 |
| --- | --- |
| 「already answers on the network」 | 有另一部裝置用緊嗰個地址，揀過第二個。 |
| 啟動咗，但其他裝置開唔到 | Linux 主機嘅網卡或交換器唔收第二個硬件地址嘅封包。部分虛擬機同 Wi-Fi 網卡會咁。改用有線介面。 |
| 網絡仲係舊設定 | 停低 app，用 `docker network rm` 刪走舊網絡，再啟動。 |
| 行咗一陣，兩部裝置撞地址 | 地址喺路由器 DHCP 範圍入面。搬出去，或者預留。 |

呢個 app 係畀你自己嘅網絡用，唔好將佢嘅地址放上互聯網，睇[資料同保安模型](../reference/security-model.md)。
