---
title: 詞彙表
summary: 程式同文件入面用到嘅詞語，用簡單方式解釋。
---

簡短嘅解釋，按英文字母排列。如果有較長嘅指南，會附上連結。

## A

**AiMesh**：ASUS 將幾部相容嘅路由器或者節點連成一個 Wi-Fi 網絡，只用一個名稱嘅方法。

**Asuswrt-Merlin**：由社群維護、適用於好多 Asus 路由器嘅韌體，喺原廠 ASUS 韌體上加入額外功能。程式入面有啲控制項只有 Merlin 先有，喺原廠韌體會以停用狀態顯示，並寫明原因。請睇[韌體偵測](../articles/setup/firmware-detection.md)。

## C

**斷線保護（Connection guard）**：進行有風險嘅改動之前，放喺路由器上嘅計時器。如果之後程式連唔到路由器，計時器會自動還原舊值。請睇[指南](../articles/safety/connection-guard.md)。

## D

**示範模式（Demo mode）**：內置嘅模擬路由器，冇真路由器都可以試用程式。佢嘅數字都係虛構嘅。

**DHCP**：路由器上嘅服務，喺裝置加入網絡時派發位址。*保留*就係令同一部裝置每次都得到同一個位址。

**DNS**：將名稱，例如網站，轉成位址嘅服務。請睇[網絡工具](../articles/tools/network-tools.md)。

## F

**韌體（Firmware）**：路由器運行嘅軟件。程式會偵測係原廠 ASUS 韌體定 Asuswrt-Merlin。

## H

**主機金鑰（Host key）**：SSH 伺服器出示、證明自己係邊部裝置嘅指紋。程式會請你批准一次，然後釘選。請睇[主機金鑰釘選](../articles/safety/host-key-pinning.md)。

## N

**NAT**：令多部裝置共用一個公共位址嘅路由器功能。*雙重 NAT* 係指前後兩部路由器都做 NAT，經常令連接埠轉發失效。

## O

**操作員（Operator）**：可以檢視路由器同改設定嘅角色。請睇[帳戶同角色](../articles/app/accounts-and-roles.md)。

**擁有者（Owner）**：第一個建立嘅帳戶，仲可以管理人員同路由器連線。

## P

**連接埠轉發（Port forwarding）**：將由外面經指定連接埠嚟嘅流量，轉去你網絡入面嘅一部裝置。

**預覽（Preview）**：套用任何改動之前顯示嘅舊值同新值清單。請睇[預覽、確認同套用](../articles/safety/safe-changes.md)。

## Q

**QoS**：服務質素，亦叫流量優先次序：決定邊類流量優先使用頻寬。

## S

**SSH**：程式同路由器溝通用嘅安全遙距登入，設定喺路由器嘅管理頁面。

**子網絡（Subnet）**：屬於同一個網絡嘅一段位址，寫法例如 `198.51.100.0/24`。

## V

**保險庫（Vault）**：儲存路由器密碼或者金鑰嘅加密位置。請睇[加密保險庫](../articles/safety/encrypted-vault.md)。

**檢視者（Viewer）**：可以睇但唔可以改嘅角色。

## W

**網絡喚醒（Wake-on-LAN）**：一種特別封包，用嚟開啟已設定好聽取佢嘅裝置，只限區域網絡。
