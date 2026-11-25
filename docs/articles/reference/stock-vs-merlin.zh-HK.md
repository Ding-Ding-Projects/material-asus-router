---
title: 原廠 ASUS 韌體定 Asuswrt-Merlin
summary: 並排比較程式支援嘅兩種韌體、各自多咗啲乜，以及點樣決定要唔要轉。
---

程式兩種都支援。佢偵測你部路由器行邊種，喺原廠韌體上，需要 Merlin 嘅控制項會顯示停用並講明原因。呢頁幫你了解分別，同決定要唔要轉。

## 佢哋係乜

| | 原廠 ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| 製作 | ASUS | 一位社群開發者，建基於 ASUS 嘅程式碼 |
| 費用 | 已包含 | 免費 |
| 支援 | 供應商 | 社群、討論區同項目頁面 |
| 更新 | 跟供應商時間表，舊型號會停 | 支援型號通常維持更耐，但仍然只限支援型號 |
| 外觀 | 供應商介面 | 幾乎一樣，多咗啲頁面 |

## Merlin 多咗乜

| 功能 | 原廠 | Merlin |
| --- | --- | --- |
| 事件時行自訂腳本 | 冇 | 有，請睇 [Merlin 腳本](../merlin/merlin-scripts.md) |
| Cron 工作 | 冇 | 有，請睇 [Cron 工作](../merlin/cron-jobs.md) |
| DNS Director | 冇 | 有，請睇 [DNS Director](../internet/dns-director.md) |
| VPN Director | 新版有類似功能 | 有，請睇 [VPN Director](../connect/vpn-director.md) |
| 附加元件同 Entware | 唔支援 | 有，請睇 [Entware](../merlin/entware.md) |
| 額外調較數值 | 有限 | 較多，喺[進階](../router/advanced.md) |
| 雲端功能同供應商程式 | 有 | 部分移除或者改變 |
| AiProtection | 有 | 部分型號有 |

## 原廠保留嘅

- 保養位置較簡單，因為你行緊供應商嘅軟件。
- 供應商嘅手機程式、雲端登入同自動更新。
- 路由器上面冇第三方程式碼。

## 要唔要轉？

| 如果你 | 建議 |
| --- | --- |
| 想直接用同自動更新 | 留喺原廠 |
| 想要腳本、進階 DNS 或者 VPN 路由、逐裝置技巧 | 考慮 Merlin |
| 用緊供應商唔再更新嘅路由器 | 型號有支援嘅話，Merlin 可能延長安全使用期 |
| 唔肯定 | 留喺原廠，先試[示範](../start/demo-router.md) |

## 轉之前

1. 確認你嘅確切型號同硬件版本有支援。
2. 備份設定，請睇[備份同還原](../router/backup-restore.md)。
3. 跟[韌體更新逐步指引](../merlin/firmware-update-walkthrough.md)。
4. 轉完之後，如果項目有講，就還原原廠設定再重新設定，唔好還原唔相容嘅備份。

## 無論邊種，程式都做到

核心嘅安全改動途徑、保護、記錄、還原，同裝置、Wi-Fi、互聯網、防火牆、VPN、USB 同系統範圍，兩種都用得。只有需要 Merlin 嘅控制項唔同。

## 狀態

呢篇係比較而唔係功能，所以標示為已完成。個別功能有各自狀態。
