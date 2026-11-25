---
title: 詞彙表
summary: 程式同文件入面用到嘅詞語，由 AiMesh 到 WPS，用簡單方式解釋，並附完整指南連結。
---

簡短嘅解釋，按英文字母排列。如果有較長嘅指南，會附上連結。例子入面嘅位址用文件專用範圍 198.51.100.0/24 同 203.0.113.0/24，唔會用真實位址。

## A

**AiMesh**：ASUS 將幾部相容嘅路由器或者節點連成一個 Wi-Fi 網絡，只用一個名稱嘅方法。請睇[管理 AiMesh 網絡](../articles/connect/aimesh-management.md)。

**AiProtection**：ASUS 內置嘅保安套件，用第三方威脅清單。請睇 [AiProtection](../articles/security/aiprotection.md)。

**接入點（Access point）**：提供 Wi-Fi 嘅裝置。路由器係一個，每個 Mesh 節點都係。

**自適應 QoS**：認得流量種類並替你排次序嘅流量優先方式。請睇[流量優先模式](../articles/connect/qos-modes.md)。

**Asuswrt-Merlin**：由社群維護、適用於好多 Asus 路由器嘅韌體，喺原廠 ASUS 韌體上加入額外功能。程式入面有啲控制項只有 Merlin 先有，喺原廠韌體會以停用狀態顯示，並寫明原因。請睇[韌體偵測](../articles/setup/firmware-detection.md)同[原廠定 Merlin](../articles/reference/stock-vs-merlin.md)。

**驗證器（Authenticator）**：手機上面嘅程式，產生每 30 秒變一次嘅六位數字碼，用作第二步登入。

## B

**回程（Backhaul）**：Mesh 節點連去主路由器嘅連線，有線或者無線。

**頻段（Band）**：一段無線電頻率。Wi-Fi 用 2.4 GHz、5 GHz，新型號仲有 6 GHz。

**波束成形（Beamforming）**：塑造訊號令更多訊號去到傾緊偈嘅裝置。請睇[波束成形](../articles/wireless/beamforming.md)。

**橋接模式（Bridge mode）**：令路由器唔再轉換位址，由前面嘅路由器負責。用嚟解決雙重 NAT。

## C

**頻道（Channel）**：Wi-Fi 頻段嘅一片。鄰居用同一個或者重疊嘅頻道會互相拖慢。

**斷線保護（Connection guard）**：進行有風險嘅改動之前，放喺路由器上嘅計時器。如果之後程式連唔到路由器，計時器會自動還原舊值。請睇[指南](../articles/safety/connection-guard.md)同[時間線](../articles/workflows/guard-timeline.md)。

**Cron**：喺指定時間行指令嘅排程器，只限 Merlin。請睇 [Cron 工作](../articles/merlin/cron-jobs.md)。

## D

**示範模式（Demo mode）**：內置嘅模擬路由器，冇真路由器都可以試用程式。佢嘅數字都係虛構嘅。

**DFS**：動態頻率選擇。部分 5 GHz 頻道同雷達共用，所以路由器要聽雷達並讓位。請睇 [DFS 頻道](../articles/wireless/dfs-channels.md)。

**DHCP**：路由器上嘅服務，喺裝置加入網絡時派發位址。*保留*就係令同一部裝置每次都得到同一個位址。請睇[規劃位址池](../articles/lan/dhcp-pool-planning.md)。

**DMZ 主機**：接收所有未被要求嘅入站流量嘅一部裝置，係最危險嘅開放方法。請睇 [DMZ 主機](../articles/lan/dmz.md)。

**DNS**：將名稱，例如網站，轉成位址嘅服務。請睇[網絡工具](../articles/tools/network-tools.md)。

**DNS Director**：Merlin 功能，強制指定裝置用指定 DNS 伺服器。請睇 [DNS Director](../articles/internet/dns-director.md)。

**DNS over TLS（DoT）**：用 853 埠加密包住嘅 DNS 查詢。請睇 [DNS over TLS](../articles/internet/dns-over-tls.md)。

**雙重 NAT（Double NAT）**：前後兩部路由器都轉換位址，經常搞壞端口轉發同部分 VPN。

**雙 WAN（Dual WAN）**：用兩條互聯網線路，做後備或者分擔。請睇[雙 WAN](../articles/internet/dual-wan.md)。

**DDNS**：動態 DNS。一個名永遠指住你屋企嘅位址，就算供應商改咗都得。請睇[動態 DNS](../articles/router/dynamic-dns.md)。

## E

**Entware**：社群套件庫，用 USB 硬碟為 Merlin 路由器加程式。請睇 [Entware](../articles/merlin/entware.md)。

**有線回程（Ethernet backhaul）**：Mesh 節點用網線連去主路由器，係最好嘅選擇。

## F

**故障轉移（Failover）**：主線壞咗就轉去後備互聯網線路。

**防火牆（Firewall）**：路由器決定容許邊啲連線嘅規則清單。請睇[防火牆規則實戰](../articles/security/firewall-rules.md)。

**韌體（Firmware）**：路由器運行嘅軟件。程式會偵測係原廠 ASUS 韌體定 Asuswrt-Merlin。

## G

**閘道（Gateway）**：流量離開網絡時去嘅裝置，喺屋企就係路由器。

**訪客網絡（Guest network）**：俾訪客用嘅獨立 Wi-Fi，同你嘅裝置分開。請睇[訪客網絡](../articles/router/guest-network.md)。

## H

**硬件位址（MAC 位址）**：網絡卡嘅識別碼，寫法好似 `AA:BB:CC:DD:EE:FF`。手機可能每個網絡用一個隨機嘅。

**隱藏網絡（Hidden network）**：唔廣播名稱嘅 Wi-Fi 網絡，並冇增加真正保安。

**主機金鑰（Host key）**：SSH 伺服器出示、證明自己係邊部裝置嘅指紋。程式會請你批准一次，然後釘選。請睇[主機金鑰釘選](../articles/safety/host-key-pinning.md)。

## I

**IGMP**：裝置要求組播串流（例如電視）用嘅協定。請睇 [IPTV 同 VLAN 標籤](../articles/internet/iptv-vlan.md)。

**IPv4 同 IPv6**：兩種互聯網位址。IPv6 多到每部裝置都可以有公開位址。請睇 [IPv6](../articles/internet/ipv6.md)。

**IPTV**：經互聯網連線傳送嘅電視，通常放喺自己嘅 VLAN。

## J

**JFFS**：路由器入面細細嘅永久儲存區，Merlin 喺度存放腳本。

## L

**區域網絡（LAN）**：你屋企入面嘅本地網絡。

**租約（Lease）**：裝置可以保留 DHCP 位址幾耐先再問。

## M

**MAC 過濾**：Wi-Fi 容許或者拒絕嘅硬件位址清單。請睇[無線 MAC 過濾](../articles/wireless/mac-filter.md)。

**Mesh**：幾個接入點當一個 Wi-Fi 網絡咁運作。

**Merlin 腳本**：路由器做某啲事（例如啟動）時行嘅腳本。請睇 [Merlin 自訂腳本](../articles/merlin/merlin-scripts.md)。

**MU-MIMO**：用唔同天線同時同幾部裝置傾偈。請睇 [OFDMA 同 MU-MIMO](../articles/wireless/ofdma.md)。

**組播（Multicast）**：一個串流同時送俾多個收聽者，電視同部分音響系統用。

## N

**NAT**：令多部裝置共用一個公共位址嘅路由器功能。請睇 [NAT 穿透](../articles/lan/nat-passthrough.md)。

**節點（Node）**：唔係主路由器嘅 Mesh 接入點。

**nvram**：路由器儲存嘅設定。程式用友善名稱顯示，原始名稱留喺進階檢視。

## O

**OFDMA**：將 Wi-Fi 頻道切成細片，令好多裝置共用一次傳送。

**操作員（Operator）**：可以檢視路由器同改設定嘅角色。請睇[帳戶同角色](../articles/app/accounts-and-roles.md)。

**擁有者（Owner）**：第一個建立嘅帳戶，仲可以管理人員同路由器連線。

**OpenVPN**：支援好廣嘅 VPN 協定。請睇 [OpenVPN](../articles/router/vpn-openvpn.md)。

## P

**丟包（Packet loss）**：冇到達嘅訊息。Wi-Fi 有少少正常，多就係故障。

**對等端（Peer）**：WireGuard 入面獲准加入伺服器嘅裝置。請睇 [WireGuard 對等端同金鑰](../articles/connect/wireguard-peers.md)。

**Ping**：一個細測試訊息，量度某個位址有冇回應同要幾耐。請睇[路由器工具](../articles/workflows/router-tools.md)。

**連接埠（Port）**：一個數字，話俾流量知係去裝置上面邊個服務，例如 443 係安全網頁。

**連接埠轉發（Port forwarding）**：將由外面經指定連接埠嚟嘅流量，轉去你網絡入面嘅一部裝置。請睇[安全地轉發端口](../articles/security/port-forward-safely.md)。

**端口觸發（Port triggering）**：屋企入面嘅裝置向外連去另一個端口之後，先開一個端口。請睇[端口觸發](../articles/lan/port-triggering.md)。

**PPPoE**：部分供應商用嘅登入式連線類型。請睇[揀連線類型](../articles/internet/wan-types.md)。

**預覽（Preview）**：套用任何改動之前顯示嘅舊值同新值清單。請睇[預覽、確認同套用](../articles/safety/safe-changes.md)。

**前綴長度（Prefix length）**：位址範圍斜線後面嘅數字，例如 `198.51.100.0/24` 嘅 24。

## Q

**QoS**：服務質素，亦叫流量優先次序：決定邊類流量優先使用頻寬。

## R

**漫遊（Roaming）**：裝置由一個接入點或者頻段轉去更強嗰個。請睇[漫遊](../articles/wireless/roaming.md)。

**路由（Route）**：話俾路由器知某個網絡嘅流量要點行嘅規則。請睇[靜態路由](../articles/lan/static-routes.md)。

## S

**SLAAC**：IPv6 裝置唔使伺服器，自己揀位址嘅方法。

**Smart Connect**：所有頻段用同一個 Wi-Fi 名，由路由器揀頻段。請睇 [Smart Connect](../articles/wireless/smart-connect.md)。

**SSH**：程式同路由器溝通用嘅安全遙距登入。請睇 [SSH 金鑰](../articles/merlin/ssh-keys.md)。

**SSID**：Wi-Fi 網絡嘅名稱。

**子網絡（Subnet）**：屬於同一個網絡嘅一段位址，寫法例如 `198.51.100.0/24`。請睇[子網絡計算機](../articles/tools/subnet-calculator.md)。

**超級確認（Super confirmation）**：重新啟動等破壞性動作用嘅兩步確認。請睇[超級確認](../articles/safety/super-confirmation.md)。

## T

**目標喚醒時間（TWT）**：Wi-Fi 6 功能，令電池裝置喺約定喚醒之間休眠。請睇[目標喚醒時間](../articles/wireless/target-wake-time.md)。

**Traceroute**：列出流量去目的地所經節點嘅測試。

**TTL**：防止封包無限循環嘅計數器，Traceroute 用佢。

## U

**UPnP**：令裝置請路由器為佢開端口。請睇 [UPnP](../articles/lan/upnp.md)。

## V

**保險庫（Vault）**：儲存路由器密碼或者金鑰嘅加密位置。請睇[加密保險庫](../articles/safety/encrypted-vault.md)。

**檢視者（Viewer）**：可以睇但唔可以改嘅角色。

**VLAN**：喺共用線路上面用數字標籤分開嘅虛擬網絡。請睇 [IPTV 同 VLAN 標籤](../articles/internet/iptv-vlan.md)。

**VPN**：私人加密隧道。請睇 [VPN](../articles/router/vpn.md)、[揀 VPN 伺服器類型](../articles/connect/vpn-servers.md)同 [VPN Director](../articles/connect/vpn-director.md)。

## W

**WAN**：路由器面向供應商同互聯網嗰一邊。

**網絡喚醒（Wake-on-LAN）**：一種特別封包，用嚟開啟已設定好聽取佢嘅裝置，只限區域網絡。

**WireGuard**：現代、快速、用金鑰對嘅 VPN 協定。請睇 [WireGuard](../articles/router/vpn-wireguard.md)。

**WPA2 同 WPA3**：Wi-Fi 加密標準，WPA3 較新較強。請睇 [Wi-Fi](../articles/router/wifi.md)。

**WPS**：唔使密碼都連到 Wi-Fi 嘅一鍵或者 PIN 方法，PIN 方式唔安全。請睇 [WPS](../articles/wireless/wps.md)。
