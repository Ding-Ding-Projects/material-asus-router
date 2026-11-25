---
title: 按症狀疑難排解
summary: 由你見到嘅現象開始，例如「冇網絡」、「Wi-Fi 慢」或者「端口轉發唔work」，跟一條短路徑搵出可能原因。
---

由症狀開始，唔係由設定開始。每節先俾快速檢查，次序係最易搵到原因嘅。呢頁講路由器同屋企網絡。安裝或者啟動程式本身嘅問題，請睇[程式疑難排解](../setup/troubleshooting.md)。

## 全部裝置都冇網絡

1. 睇**概覽**，路由器連線係咪顯示已連線？
2. 未連線：有數據機或者 ONT 就重啟，等兩分鐘，再檢查[連線類型](../internet/wan-types.md)。類型或者登入資料錯係常見原因。
3. 已連線但乜都載入唔到：用數字 [ping](../tools/network-tools.md) 一個公開位址。數字得、名唔得：係 DNS，請改 DNS 伺服器，睇 [DNS over TLS](../internet/dns-over-tls.md)。
4. 連數字 ping 都失敗：聯絡供應商，故障喺佢哋嗰邊。

## 一部裝置冇網絡

1. 有冇連去 Wi-Fi，Wi-Fi 密碼仲啱嗎？
2. 有冇喺[裝置](../router/devices.md)或者[家長排程](../security/parental-schedules.md)被**封鎖**？
3. 有冇位址？冇位址或者位址係裝置自己編出嚟嘅，代表冇由路由器攞到，重啟佢嘅 Wi-Fi。
4. 另一部裝置用咗同一個位址，請睇[規劃位址池](../lan/dhcp-pool-planning.md)。

## Wi-Fi 慢

| 檢查 | 話你知 |
| --- | --- |
| 同一條線用有線測試 | 有線快就係 Wi-Fi 問題，有線都慢就係線路或者供應商 |
| 距離同牆 | 訊號弱，請睇[漫遊](../wireless/roaming.md)同 [AiMesh](../connect/aimesh-management.md) |
| 2.4 GHz 擠 | 請睇 [DFS 頻道](../wireless/dfs-channels.md)同[頻道分析器](../tools/wifi-channel-analyser.md) |
| 淨係忙嘅時候慢 | 用[流量優先](../connect/qos-modes.md) |
| 淨係一部裝置慢 | 舊裝置，或者黐咗喺差嘅頻段，請睇 [Smart Connect](../wireless/smart-connect.md) |

## Wi-Fi 不停斷線

- 單一裝置：睇 [OFDMA](../wireless/ofdma.md)、[目標喚醒時間](../wireless/target-wake-time.md)同[波束成形](../wireless/beamforming.md)，試關一個再測試。
- 所有裝置喺同一個鐘數斷：喺[記錄](../router/logs.md)睇有冇 DFS 雷達事件同排程重啟。
- 全部隨機斷：電源或者過熱，俾路由器透氣。

## 端口轉發唔work

1. 喺屋企外面測試，唔好喺入面。
2. 目標裝置有固定位址嗎？規則入面嗰個位址啱嗎？
3. 服務有冇聆聽？裝置自己嘅防火牆有冇容許？
4. 協定（TCP 或者 UDP）啱嗎？
5. **雙重 NAT。** 如果路由器嘅互聯網位址本身係私人位址或者供應商共用位址（喺路由器嘅互聯網狀態頁睇到，供應商都可以確認），代表前面仲有一部裝置喺度轉換。要喺嗰度都轉發，或者將前面嗰部設為橋接模式。
6. 有啲供應商完全唔俾公開位址，要問佢哋。請睇[安全地轉發端口](../security/port-forward-safely.md)。

## 連唔到路由器頁面，或者程式失去路由器

1. 你用緊嘅路由器位址仲係路由器位址嗎？改咗位址頁面就搬咗。
2. 啱啱有改動行過嗎？[保護](../safety/connection-guard.md)大約 90 秒內會還原舊值。
3. 檢查主機金鑰。路由器金鑰變咗，程式會特登停低，請睇[主機金鑰固定](../safety/host-key-pinning.md)。
4. 最後手段：路由器嘅重設掣會還原原廠設定，再還原你嘅[備份](../router/backup-restore.md)。

## VPN 連唔到

按次序檢查：伺服器有冇開、端口有冇轉發或者連得到、位址或者名稱有冇解析去你屋企、冇雙重 NAT，同 VPN 位址範圍有冇同你去嘅網絡衝突。請睇 [VPN 伺服器類型](../connect/vpn-servers.md)。

## 智能裝置設定唔到

可能淨係支援 2.4 GHz。設定時用獨立嘅 2.4 GHz 名稱，請睇 [Smart Connect](../wireless/smart-connect.md)。

## 仲係唔得？

收集路由器[記錄](../merlin/logging.md)、型號同韌體版本，同你最後改過乜。[變更記錄](../safety/change-history.md)會話你知程式改過乜同幾時，而且可以還原。
