---
title: Wiki 首頁
summary: Material Asus Router 嘅簡短解答、詞彙同項目筆記。
---

Wiki 收錄簡短頁面：為使用、開發或者維護 Material Asus Router 嘅人而設嘅詞彙、決定同筆記。較長、按任務編排嘅指南喺文件入面，新手建議由嗰度開始。

## 俾使用者

- 新手？先睇[歡迎指南](../articles/start/welcome.md)，然後試下唔使真路由器嘅[示範路由器](../articles/start/demo-router.md)。
- 唔肯定某個詞語嘅意思？睇[詞彙表](glossary.md)。
- 想知點解有啲嘢未有或者有限制？睇[已知限制](known-limitations.md)。
- 想知改動點樣保持安全？睇[預覽、確認同套用](../articles/safety/safe-changes.md)同[斷線保護](../articles/safety/connection-guard.md)。

## 按任務搵指南

| 我想 | 由呢度開始 |
| --- | --- |
| 解決見到嘅問題 | [按症狀疑難排解](../articles/reference/troubleshooting-by-symptom.md) |
| 令 Wi-Fi 更快更穩 | [漫遊](../articles/wireless/roaming.md)、[DFS 頻道](../articles/wireless/dfs-channels.md)、[Smart Connect](../articles/wireless/smart-connect.md) |
| 了解互聯網連線 | [揀連線類型](../articles/internet/wan-types.md)、[IPv6](../articles/internet/ipv6.md)、[DNS over TLS](../articles/internet/dns-over-tls.md) |
| 安全開端口 | [安全地轉發端口](../articles/security/port-forward-safely.md) |
| 加固路由器 | [加固清單](../articles/security/hardening-checklist.md)、[保安深入篇](../articles/security/threat-model.md) |
| 喺外面連返屋企 | [揀 VPN 伺服器類型](../articles/connect/vpn-servers.md)、[WireGuard 對等端同金鑰](../articles/connect/wireguard-peers.md) |
| 行腳本或者附加元件 | [Merlin 自訂腳本](../articles/merlin/merlin-scripts.md)、[原廠定 Merlin](../articles/reference/stock-vs-merlin.md) |
| 睇程式點樣保持安全 | [保護計時器逐步睇](../articles/workflows/guard-timeline.md)、[SSH 動作目錄](../articles/workflows/ssh-action-catalogue.md) |

## 俾貢獻者

- 程式點解咁運作：[設計決定](design-decisions.md)。
- 點樣設定、修改同提出工作：[貢獻者指南](contributor-guide.md)。
- 發佈版本之前必須做到嘅嘢：[發行檢查清單](release-checklist.md)。

## 項目係乜

Material Asus Router 係一個自行架設嘅網頁程式，經 SSH 管理 Asus 路由器。佢支援 ASUS 原廠韌體同 Asuswrt-Merlin，會偵測你用邊種，喺原廠韌體上將只有 Merlin 先有嘅控制項以停用狀態顯示，並寫明原因。同一個版本計劃推出 Windows 桌面程式。

## 點睇狀態標籤

| 標籤 | 意思 |
| --- | --- |
| 就緒 | 已經做好並檢查過，可以放心依賴。 |
| 開發中 | 製作緊。頁面會寫明欠缺乜，暫時唔好依賴。 |

呢個階段大部分頁面都係**開發中**，每頁都會清楚講明對佢嚟講係咩意思。

## 其他地方

- 原始碼同問題追蹤：<https://github.com/Ding-Ding-Projects/material-asus-router>
- 呢個網站：<https://ding-ding-projects.github.io/material-asus-router/>
