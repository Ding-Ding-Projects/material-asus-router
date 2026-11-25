---
title: 貢獻者指南
summary: 點樣用模擬路由器運行程式、執行測試、建置網站同提出改動。
---

多謝你幫手。呢頁係精簡版，如果同程式庫嘅 `CONTRIBUTING.md` 有出入，以後者為準。

## 設定

1. 安裝 Node.js 22 或以上版本。
2. 複製 <https://github.com/Ding-Ding-Projects/material-asus-router>，然後執行 `npm install`。
3. 用 `npm run demo` 連接內置模擬路由器啟動程式，然後打開 `http://localhost:8790/`。

開發大部分功能都唔需要真路由器。模擬路由器亦係其他人使用示範模式嘅基礎。

## 執行測試

```
npm test
```

測試使用模擬路由器。新增行為時，請喺 `tests/` 入面對應嘅檔案旁邊加測試。

## 基本規則

- 所有路由器寫入都要經過改動引擎：預覽、確認、儲存舊值、套用。唔好新增直接寫入嘅畫面。請睇[設計決定](design-decisions.md)。
- 瀏覽器輸入永遠唔好傳入路由器 shell。要由伺服器用檢查過嘅數值建立固定指令。
- 介面改動先喺 `design/canvas/` 嘅設計畫布完成，再照住建置。
- 每句面向用戶嘅文字都要有英文同用繁體字寫嘅香港粵語，唔好機器翻譯。
- 未完成嘅功能標示為**開發中**，並寫明欠缺乜。唔好將計劃描述成已可使用嘅功能。
- 文件嘅範例位址用 `198.51.100.1` 同 `198.51.100.0/24`，範例人名用 Pat 同 Alex。
- 每個示範輸出都要標明係範例，唔好將虛構輸出當成來自真路由器。

## 撰寫文件

文件放喺 `docs/`。指南係 `docs/articles/<類別>/<名稱>.md`，粵語版係 `<名稱>.zh-HK.md`；wiki 頁面係 `docs/wiki/<名稱>.md`。完整嘅前置資料同連結規則喺 `docs/README.md`。

建置同檢查網站：

```
node scripts/build-site.mjs site
```

前置資料鍵名錯、連去唔存在嘅頁面、未知嘅相關代碼，或者唔係真實擷取嘅圖片，建置都會失敗，開 pull request 之前請先修正。螢幕擷取一定要係列喺 `evidence/manifest.json` 嘅真實擷取，唔可以偽造。

## 提出改動

1. Fork，由 `main` 開分支，每次只做一個合理嘅改動。
2. 喺 pull request 描述行為改咗乜，同你點樣驗證。
3. 呢個程式庫係公開嘅，用一般專業英文，所以要確認公開用語掃描通過。

## 安全問題

唔好為漏洞開公開 issue，請跟 `SECURITY.md`。

## 相關

[發行檢查清單](release-checklist.md)、[已知限制](known-limitations.md)、[詞彙表](glossary.md)。
