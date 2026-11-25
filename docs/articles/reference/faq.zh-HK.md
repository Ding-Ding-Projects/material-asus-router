---
title: 常見問題
summary: 簡短回答 app 做啲咩、儲存啲咩、邊啲仲喺開發中，以及出事點算。
---

## 基本

### 任何路由器都用得？

佢係為行原廠 ASUS 韌體或 Asuswrt-Merlin、經 SSH 管理嘅 Asus 路由器而做。佢會由路由器讀取型號同能力，所以路由器冇嘅硬件功能會顯示成停用並講明原因。其他牌子唔支援。唔係每個型號都試過；項目可以講完整行過嘅，只有模擬路由器。見[韌體偵測](../setup/firmware-detection.md)。

### 要 Docker 嗎？

網頁版要：佢以 Docker 映像發佈。唔使 Docker 嘅 Windows 桌面版計劃中但未建置，見 [Windows 桌面版](../delivery/desktop-app.md)。

### 冇路由器都試到？

得。示範模式會行一部模擬路由器。見[試用示範路由器](../start/demo-router.md)。

### 邊啲功能完成咗？

每篇指南都有**已完成**或**進行中**標籤，進行中嘅指南會列出欠咩。以標籤做準，唔好睇歡迎頁嗰份範圍清單。

## 安全

### 改動會唔會令我連唔到路由器？

可能令你斷線嘅改動，套用之前會先喺路由器設定計時還原（預設 90 秒）。如果 app 再連唔到路由器去取消，路由器會自己還原舊值。見[斷線保護](../safety/connection-guard.md)。冇安全網包得晒所有情況，所以請保持路由器自己嘅管理頁可以開，同埋做好[備份](../router/backup-restore.md)。

### 可以還原改動嗎？

可以。每個已套用嘅改動都喺紀錄入面，有舊值同還原掣。見[還原改動](../safety/undo-changes.md)。

### 點解重啟要確認兩次？

重啟會斷晒所有人嘅連線，所以要兩重確認：輸入路由器確切嘅型號名稱，再按住按鈕。

### 會唔會整壞路由器？

App 只會用路由器自己頁面用嘅同一套機制改設定，亦唔會自己刷韌體。不過錯誤嘅設定都可能令路由器用唔到，直到重設，所以請睇清楚每個預覽。項目唔可以保證唔可能出事。

## 帳戶

### 邊個睇到我部路由器？

任何連到 app 地址又有帳戶嘅人。檢視者可以讀取路由器設定，但係改唔到嘢，亦睇唔到被遮住嘅機密。操作員仲可以改嘢，同顯示單一機密數值。見[人員同角色](../setup/people-and-roles.md)。

### 我唔記得擁有者密碼。

冇電郵重設。還原之前嘅資料卷備份，或者用全新嘅資料卷再連接路由器。見[第一個擁有者帳戶](../setup/first-owner-account.md)同[備份資料卷](../setup/backing-up-data.md)。

### 有雲端帳戶嗎？

冇。冇任何嘢會送俾其他人。App 只同你部路由器溝通。

## 連線

### 金鑰定密碼？

用 app 產生嘅金鑰，咁就完全唔使儲存路由器密碼。密碼方式係留俾暫時未加到金鑰嘅情況。見[連接路由器](../setup/connect-router.md)。

### 佢要我批准嘅指紋係咩？

佢係路由器 SSH 主機金鑰嘅識別。批准一次之後，如果之後有另一部裝置出現喺同一個地址，app 就會拒絕。

### App 話主機金鑰變咗。

見[疑難排解](../setup/troubleshooting.md)。

### 屋企以外可以管理路由器嗎？

唔好將 app 嘅端口開放上互聯網。用 VPN 返入你嘅網絡，app 留喺內網。

## 運行

### 我嘅資料喺邊？

喺 `router-data` Docker 資料卷。見[備份資料卷](../setup/backing-up-data.md)。

### 點更新？

再行 `host.bat`。見[更新 app](../setup/updating.md)。

### 點解話端口被佔用？

有其他程式用緊 8790。行 `host.bat --detached --port 8791`。

### Raspberry Pi 行得嗎？

映像除咗 `linux/amd64` 仲有 `linux/arm64`，所以有 Docker 嘅 64 位元 Pi 應該得。呢點喺度未驗證過。

## 語言同私隱

### 有廣東話版嗎？

說明網站每篇指南都有廣東話版。冇廣東話版嘅指南會顯示英文版並附通知。

### App 收集啲咩？

冇嘢離開你嘅網絡。佢將帳戶、路由器連線同改動紀錄儲存喺你自己嘅資料卷。見[資料同安全模型](security-model.md)。

## Wi-Fi 同互聯網

### 點解部手機死死地黐住弱訊號？

手機自己決定幾時轉，好多都等得太遲。漫遊助手可以推一推，但要解決死角就要加多個接入點。請睇[漫遊](../wireless/roaming.md)同[管理 AiMesh 網絡](../connect/aimesh-management.md)。

### 所有頻段用同一個 Wi-Fi 名好嗎？

手機同電腦就好，用 [Smart Connect](../wireless/smart-connect.md)。智能插座等唔肯連嘅小工具，另外留一個 2.4 GHz 名。

### 用 DFS 頻道安全嗎？

安全，而且通常最靜。路由器用之前要聽一分鐘雷達，聽到就會讓位。如果 Wi-Fi 每日同一個鐘數斷，就轉用固定頻道。請睇 [DFS 頻道](../wireless/dfs-channels.md)。

### 連線類型點揀？

由自動 IP 開始。供應商俾咗用戶名同密碼先用 PPPoE。請睇[揀連線類型](../internet/wan-types.md)。

### DNS over TLS 值得用嗎？

佢令線路睇唔到你嘅查詢，並將信任轉去你揀嘅解析器。你揀咗比供應商更信任嘅解析器就值得。請睇 [DNS over TLS](../internet/dns-over-tls.md)。

### 點解端口轉發喺屋企入面得，喺外面唔得？

喺入面測試通常無論路由器點設定都成功。要用流動數據測試。外面失敗最常見係雙重 NAT。請睇[按症狀疑難排解](troubleshooting-by-symptom.md)。

## 保安

### MAC 過濾係真正保安嗎？

唔係。位址可以抄，手機又可能每個網絡用隨機位址。佢只擋到隨便嘅訪客。請睇[無線 MAC 過濾](../wireless/mac-filter.md)。

### 要唔要關 UPnP？

有鏡頭、家用伺服器或者共用電腦就關，只轉發需要嘅。只有一部遊戲機而冇特別嘅嘢，佢係合理嘅方便。請睇 [UPnP](../lan/upnp.md)。

### DMZ 主機有冇好用嘅時候？

好少。佢令一部裝置所有端口都暴露。先試[端口轉發](../security/port-forward-safely.md)或者[觸發](../lan/port-triggering.md)。

### 最有用嘅十項保安設定係乜？

[加固清單](../security/hardening-checklist.md)按次序列出。

## VPN、USB 同 Mesh

### 應該行邊種 VPN 伺服器？

路由器有就用 WireGuard，否則用 OpenVPN，避免 PPTP。請睇[揀 VPN 伺服器類型](../connect/vpn-servers.md)。

### 可以只將部分裝置經 VPN 嗎？

喺 Asuswrt-Merlin 可以，用 [VPN Director](../connect/vpn-director.md)。

### USB 硬碟可以做檔案伺服器嗎？

可以，做輕量工作。請睇 [USB 應用](../connect/usb-apps.md)。

## Merlin 同程式工具

### 一定要 Asuswrt-Merlin 嗎？

唔使。程式兩種都支援。Merlin 多咗腳本、cron 同 DNS 或者 VPN 路由。請睇[原廠定 Merlin](stock-vs-merlin.md)。

### 可以喺程式行自己嘅指令嗎？

正常畫面唔得。程式只會發出固定嘅[動作目錄](../workflows/ssh-action-catalogue.md)。擁有者專用嘅[終端機](../workflows/owner-terminal.md)屬計劃中。

### 一鍵模式係乜？

有名嘅設定組合，例如睡覺或者訪客，作為一次預覽過嘅改動套用，一次還原。屬計劃中，請睇[一鍵模式](../workflows/one-click-modes.md)。

### 點解網站上面有啲示範嘅數字係虛構？

佢哋用嚟教一個概念，並且一定標明係示範。永遠唔會讀或者改你嘅路由器。

## 參考

- [API 概覽](api.md)
- [環境變數同選項](environment-variables.md)
