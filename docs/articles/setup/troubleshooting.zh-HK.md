---
title: 連線錯誤疑難排解
summary: 啟動或連接失敗時，app 同 host.bat 顯示嘅每一個訊息、原因同解決方法。
---

搵你見到嗰個訊息。標住 *host.bat* 嘅出自啟動 script，其餘出自 app。訊息本身係英文原文，下面解釋用廣東話。

## 啟動 app（host.bat）

| 訊息 | 原因 | 解決方法 |
| --- | --- | --- |
| the docker command is not installed on this computer | 未裝 Docker，或者唔喺路徑入面 | 安裝 Docker Desktop 再行 script。 |
| Docker Compose is not available | Docker 太舊，冇 Compose 外掛 | 更新 Docker Desktop 或安裝 Compose 外掛。 |
| Docker is installed but not running | Docker 服務未開 | 開 Docker Desktop，等到顯示運行中。 |
| Docker on user@host cannot be reached over SSH | 連 Docker 主機嘅 SSH 要密碼或者失敗 | 令 `ssh user@host docker info` 唔使輸入就行到。見[遠端 Docker 主機](remote-docker.md)。 |
| the remote target must look like user@host | `--remote` 格式錯 | 用 `pat@198.51.100.5` 呢種格式。 |
| the image could not be pulled | 冇網絡、連唔到 `ghcr.io`，或者標籤唔存在 | 檢查網絡同 `--tag`。 |
| --skip-pull was given, but the image is not on the host | 唔拉取就冇嘢可以啟動 | 拎走 `--skip-pull`，或者先載入映像。 |
| the app did not start. If the port is taken | 有其他程式用緊個端口 | 用 `--port 8791` 或其他空閒端口再行。 |
| the app started but did not report healthy within 90 seconds | 容器不斷崩潰 | 行 `host.bat --logs` 睇最後幾行。 |
| the app is healthy inside Docker, but the address does not answer from this computer | 防火牆擋咗公開端口 | 喺主機防火牆允許個端口。 |
| Unknown option | 選項打錯 | 對照[安裝](install.md)檢查拼寫。 |

## 連接路由器

| 訊息 | 原因 | 解決方法 |
| --- | --- | --- |
| Connect a router first. | 仲未連接路由器 | 打開設定畫面[連接](connect-router.md)。 |
| Enter the router's SSH user name. | 用戶名空白或者有奇怪字元 | 輸入路由器嘅 SSH 帳戶名。 |
| The SSH port must be from 1 to 65535. | 端口數字錯 | 用 22 或者你喺路由器設定嘅端口。 |
| Enter the router's SSH password. | 揀咗密碼方式但冇密碼 | 輸入密碼，或者轉用金鑰方式。 |
| Generate this app's SSH key first, then allow it on the router. | 揀咗金鑰方式但未有金鑰 | 按**產生金鑰**，再喺路由器加公鑰。 |
| The router refused the user name, password or key. | 帳戶錯、密碼錯，或者金鑰未獲允許 | 檢查用戶名、重新輸入密碼，或者將公鑰加去路由器授權金鑰。 |
| Could not reach the router: ... | 地址錯、SSH 關咗、路由器關咗，或者網絡阻擋 | 確認地址（例如 `198.51.100.1`）啱、SSH 已開俾區域網絡、而且 Docker 主機連到路由器。 |
| Could not reach the router: the connection closed. | 路由器提早斷開連線 | 再試。檢查 SSH 已啟用，冇被防火牆規則限制。 |
| The router took too long to answer. | 路由器慢或者忙 | 等一陣再試。好忙嘅路由器可能需要重啟。 |
| Approve the router's host key to continue. | 第一次連接 | 核對指紋，批准一次。 |
| Connect to the router first. | 5 分鐘批准時間已過 | 再按**連接**，然後批准。 |
| That does not match the key the router showed. | 你批准嘅指紋唔係等候中嗰條 | 再連接，批准而家顯示嗰條。 |
| The router presented a different host key than the one you approved. | 路由器金鑰變咗，或者有其他嘢應答嗰個地址 | 見下面。 |
| The router key is missing. Generate one again. | 保險庫已經冇私鑰 | 產生新金鑰，再喺路由器允許。 |
| The router is using this key now. Replacing it needs confirmation. | 金鑰使用緊時要求產生新金鑰 | 只有你可以喺路由器允許新金鑰先好確認。 |

### 主機金鑰改變咗

呢個係安全煞掣。常見而無害嘅原因：你重設咗路由器、重新刷韌體或者還原咗設定。較少見：另一部裝置攞咗路由器個地址。先查清楚邊個應答嗰個地址。如果肯定係你自己做嘅改動，以擁有者身分揀**忘記路由器**，再連接並批准新金鑰。

## 登入同權限

| 訊息 | 原因 | 解決方法 |
| --- | --- | --- |
| That user name or password is not right. | 資料錯 | 重新輸入。用戶名唔分大細寫。 |
| Too many failed sign-ins. Wait 15 minutes and try again. | 該地址嘅次數限制 | 等一陣，再正確登入。 |
| This router manager already has an owner. Sign in instead. | 已經完成過設定 | 登入。 |
| Passwords need 12 to 256 characters. | 密碼長度 | 用長啲嘅密碼。 |
| User names are 2 to 40 letters, digits, dots, dashes or underscores. | 用戶名無效 | 拎走空格同其他符號。 |
| That user name is already used. | 重複 | 揀另一個用戶名。 |
| Your account can view the router but not change it. | 檢視者角色 | 叫擁有者俾你操作員角色。 |
| Only the owner can do this. | 擁有者專屬動作 | 叫擁有者做。 |
| The page is out of date. Reload and try again. | 頁面冇咗階段權杖 | 重新載入頁面，需要嘅話再登入。 |

## 改設定

| 訊息 | 原因 | 解決方法 |
| --- | --- | --- |
| That preview expired. Preview the changes again. | 過咗太耐 | 重新預覽。 |
| Another change is being applied. Wait for it to finish. | 同時有兩個改動 | 等一陣。 |
| ... changed on the router since the preview. Preview again. | 有人改咗佢 | 重新預覽，睇新嘅舊值。 |
| The router would not start its safety timer, so nothing was changed. | 路由器設定唔到計時還原 | 冇嘢被套用，再試。重複出現嘅話，路由器可能唔容許嗰個指令。 |

計時點運作見[斷線保護](../safety/connection-guard.md)。

## 仍然解決唔到

行 `host.bat --logs` 睇最後幾行。唔好公開貼出含密碼或指紋嘅日誌、備份或截圖。睇[常見問題](../reference/faq.md)，之後喺倉庫開 issue。
