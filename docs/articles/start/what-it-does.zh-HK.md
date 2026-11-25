---
title: App 做到啲咩
summary: App 嘅所有範圍、每個範圍可以做啲咩，以及邊啲部分仲喺開發中。
---

Material Asus Router 透過 SSH 連去你部路由器，讀取設定，再用易讀嘅畫面顯示出嚟。要改設定，一定經過預覽、確認，同埋記入紀錄。

## 各個範圍

| 範圍 | 包括 | 指南 |
| --- | --- | --- |
| 總覽 | 型號、韌體、運行時間、負載、WAN 狀態 | [總覽](../router/overview.md) |
| 裝置 | 已連接裝置、名稱、網絡喚醒 | [裝置](../router/devices.md) |
| Wi-Fi | 各個頻段同訪客網絡 | [Wi-Fi](../router/wifi.md) |
| 互聯網 | 連線類型、DNS、動態 DNS | [互聯網](../router/internet.md) |
| 區域網絡 | 路由器地址、DHCP、保留地址 | [區域網絡](../router/local-network.md) |
| 端口轉發 | 將端口開放俾某部裝置嘅規則 | [端口轉發](../router/port-forwarding.md) |
| 防火牆 | 防火牆開關同過濾 | [防火牆](../router/firewall.md) |
| 家長監控 | 每部裝置嘅時間同存取規則 | [家長監控](../router/parental-controls.md) |
| 流量優先 | QoS | [流量優先](../router/traffic-priority.md) |
| VPN | OpenVPN 同 WireGuard | [VPN](../router/vpn.md) |
| AiMesh | 網狀節點 | [AiMesh](../router/aimesh.md) |
| USB 同儲存 | 接駁嘅硬碟同分享 | [USB 同儲存](../router/usb-storage.md) |
| 紀錄 | 路由器系統紀錄 | [紀錄](../router/logs.md) |
| 網絡工具 | Ping、traceroute、名稱查詢 | [網絡工具](../tools/network-tools.md) |
| 排程工作 | 只限 Merlin | [排程工作](../router/scheduled-jobs.md) |
| 備份同還原 | 下載同重新套用設定 | [備份同還原](../router/backup-restore.md) |
| 韌體、系統、維護 | 更新、時間、重啟、整理 | [韌體](../router/firmware.md)、[系統](../router/system.md)、[維護](../router/maintenance.md) |
| Merlin 額外功能 | 只限 Merlin 嘅控制項 | [Merlin 額外功能](../router/merlin-extras.md) |
| 進階 | 路由器每個數值，先顯示友善名稱 | [進階](../router/advanced.md) |
| 改動紀錄 | 每次改動，一鍵還原 | [改動紀錄](../safety/change-history.md) |

## 貫穿全部嘅三個概念

- **預覽、確認、儲存、套用。**冇改動會直接送去路由器。見[安全地改動](../safety/safe-changes.md)。
- **高風險改動有計時還原。**可能令你斷線嘅改動，會先喺路由器設定還原計時。見[斷線保護](../safety/connection-guard.md)。
- **老實嘅韌體偵測。**喺原廠 ASUS 韌體上，只限 Merlin 嘅控制項照樣顯示，但係停用，並且講明原因。見[韌體偵測](../setup/firmware-detection.md)。

## 人同角色

第一個建立嘅帳戶就係擁有者。擁有者可以加操作員（可以改設定）同檢視者（只可以睇）。見[帳戶同角色](../app/accounts-and-roles.md)。

## 仲未做好嘅部分

每篇範圍指南都有狀態標籤。標住「進行中」嘅範圍，指南會寫明欠咩。上面嘅範圍表係計劃嘅涵蓋範圍，唔代表每個畫面已經存在。想知今日真正做到啲咩，請用[示範路由器](demo-router.md)睇。
