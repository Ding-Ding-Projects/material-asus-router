// A hand-written, honest inventory of the appearance work: one entry per
// requirement, saying what works and what is still missing. It is data, so the
// screen shows it and tests check that nothing was left out. "working" means
// built and covered by tests in this repository; it never means "proved on a
// real browser at every size", which needs the headless matrix (see
// the clipping matrix below).

export const STATES = { working: "Working", partial: "Partly working", progress: "In progress" };

export const INVENTORY = [
  { id: "material-design", state: "partial", title: { en: "Material 3 conformance", yue: "Material 3 規範" },
    works: { en: "Colour roles come from one seed colour in light and dark; shape, density and font are adjustable; every control is a Material component from the component list below.", yue: "顏色角色由一個種子色生成，淺色同深色都有；形狀、密度同字體可調；每個控制項都係下面組件清單入面嘅 Material 組件。" },
    missing: { en: "The stock screens were written before this inventory, so a full per-screen audit of each surface is not done.", yue: "原有畫面喺呢份清單之前寫成，逐個畫面嘅完整審核未做。" } },
  { id: "motion", state: "partial", title: { en: "Motion and reduced motion", yue: "動態同減少動態" },
    works: { en: "Fourteen kinds of animated element are editable, with four profiles, global speed, import and export. Reduced motion, Low stimulation and the system setting all stop motion, and the rainbow settles on one hue.", yue: "十四類動畫元素可編輯，有四個設定檔、整體速度、匯入同匯出。減少動態、低刺激同系統設定都會停止動態，彩虹會停喺一個色相。" },
    missing: { en: "The full-screen celebration or alarm for installation success and errors is not built: this app has no installer flow of its own, only router firmware updates, which still use the stock dialogs.", yue: "安裝成功同出錯嘅全螢幕動畫未做：呢個程式冇自己嘅安裝流程，只有路由器韌體更新，仍然用原有對話框。" } },
  { id: "live-charts", state: "partial", title: { en: "Live charts", yue: "即時圖表" },
    works: { en: "Download and upload charts with an easing line, pulsing live dot, gradient, quiet grid, animated axis and badge, pointer and keyboard scrubbing, a spoken summary, and honest loading, paused, empty and out-of-date states. Gaps are never filled in.", yue: "下載同上傳圖表：緩動線、脈動即時點、漸層、淡格線、動態座標同徽章、滑鼠同鍵盤逐點睇、語音摘要，同誠實嘅載入、暫停、冇資料、過時狀態。缺口絕不填補。" },
    missing: { en: "The stock Overview screen still draws its own simple chart. A timed recording of a live update in both motion states has not been made.", yue: "原有概覽畫面仍然用自己嘅簡單圖表。兩種動態狀態下即時更新嘅計時錄影未做。" } },
  { id: "appearance-editor", state: "partial", title: { en: "Per-element appearance editor", yue: "逐元素外觀編輯器" },
    works: { en: "Sixteen kinds of element, five states, twelve properties as layers; non-modal panel beside the element; Alt + right-click, Pick an element and Ctrl+Alt+E; undo and redo, append-only history, named presets, copy and paste style, import and export; an Animation tab.", yue: "十六類元素、五種狀態、十二項屬性以圖層形式；元素旁邊嘅非模態面板；Alt＋右鍵、「揀元素」同 Ctrl+Alt+E；還原重做、只增不減嘅記錄、命名預設、複製貼上樣式、匯入匯出；動畫分頁。" },
    missing: { en: "Gradients, blend modes, masks, filters and per-word typography are not built (the capability matrix says so). The per-click screenshot set is not made.", yue: "漸層、混合模式、遮罩、濾鏡同逐字排版未做（功能表有寫明）。逐次點擊嘅截圖未做。" } },
  { id: "color-picker", state: "partial", title: { en: "Colour picker and translator", yue: "顏色選擇器同轉換器" },
    works: { en: "A continuous field, hue, alpha and OKLCH sliders, number entry for twelve formats, gamut and contrast notes, saved colours with import and export, and the animated rainbow as a separate choice that is never stored in the palette.", yue: "連續色場、色相、透明度同 OKLCH 滑桿、十二種格式嘅數字輸入、色域同對比度提示、可匯入匯出嘅已儲存顏色，同動態彩虹（獨立選擇，永不存入色盤）。" },
    missing: { en: "The name search has a regex mode with a small builder, not a full RegexBuddy-level builder.", yue: "名稱搜尋有正則模式同簡單建構器，唔係 RegexBuddy 級別嘅完整建構器。" } },
  { id: "logo-customization", state: "partial", title: { en: "Logo customization", yue: "標誌自訂" },
    works: { en: "Six presets and a local image upload with real byte checks (PNG, JPEG, GIF, WebP), refusal of animated and oversized images, crop, fit, focal point and background, and the previous logo kept after any failure. The image never leaves the browser.", yue: "六個預設同本機圖片上載：真實位元組檢查（PNG、JPEG、GIF、WebP）、拒絕動畫同過大圖片、裁切、適配、焦點同背景，失敗後保留原本標誌。圖片永不離開瀏覽器。" },
    missing: { en: "Decoding uses the browser's own image decoder, which is sandboxed by the browser but is not a separate decoder process of this app.", yue: "解碼用瀏覽器自己嘅圖片解碼器（瀏覽器已隔離），唔係呢個程式獨立嘅解碼程序。" } },
  { id: "overlay-panels", state: "partial", title: { en: "Overlays and panels", yue: "浮層同面板" },
    works: { en: "Floating panels stay inside the window, scroll inside, drag by the header, resize from every edge and corner, work from the keyboard, and remember size and position with a reset.", yue: "浮動面板留喺視窗內、內部捲動、拖動標題移動、由每條邊同每個角調整大細、可用鍵盤、記住大細同位置並可重設。" },
    missing: { en: "The stock modal dialogs are not resizable.", yue: "原有嘅模態對話框唔可以調整大細。" } },
  { id: "collapse-filters", state: "partial", title: { en: "Collapsible filters and statistics", yue: "可收合篩選同統計" },
    works: { en: "A collapsible section remembers its state, is keyboard operable, announces its state, and says when a hidden filter is still active. Descriptive sections start collapsed. Used on the colour search, the motion element search and the statistics.", yue: "可收合區塊記住狀態、可用鍵盤、會報讀狀態，而且收埋咗仍然生效嘅篩選會講出嚟。描述性區塊預設收合。已用於顏色搜尋、動畫元素搜尋同統計。" },
    missing: { en: "The stock screens' own search and filter rows are not wrapped yet.", yue: "原有畫面自己嘅搜尋同篩選列未包裝。" } },
  { id: "accessibility-sizing", state: "partial", title: { en: "Accessibility and sizing", yue: "無障礙同大細" },
    works: { en: "An accessibility menu in the top bar: text size, contrast, reduced motion, focus ring, larger targets, keyboard help and read-aloud that skips secrets. Hiding it needs confirmation with Cancel focused, and reset brings it back. Density and wrapping rules for narrow widths.", yue: "頂欄嘅無障礙選單：文字大細、對比度、減少動態、焦點框、較大觸控目標、鍵盤說明同略過機密嘅朗讀。隱藏需確認（預設聚焦「取消」），重設可還原。窄闊度嘅密度同換行規則。" },
    missing: { en: "No clipping at 360 px, every scale, density and language has not been measured on the built app yet.", yue: "360 px、各縮放、密度同語言下冇裁切，喺已建置程式上仲未量度。" } },
  { id: "functional-ui", state: "partial", title: { en: "Functional UI and truthful empty states", yue: "功能完整嘅介面同誠實空狀態" },
    works: { en: "Every new control does what its label says. Empty states say what is missing and how to start. Changes that are discarded from the pending-changes bar are recorded and can be restored.", yue: "每個新控制項都做到標籤講嘅嘢。空狀態會講缺咗乜同點開始。喺待處理改動列放棄嘅改動會被記錄，可以還原。" },
    missing: { en: "The stock screens were not audited for every tiny affordance.", yue: "原有畫面嘅每個細小操作未逐個審核。" } },
  { id: "design-reference-parity", state: "progress", title: { en: "Design-reference parity", yue: "設計參考對照" },
    works: { en: "The design boards exist under design/canvas.", yue: "設計畫板喺 design/canvas 入面。" },
    missing: { en: "The plain reference viewer, matching routes, capture tuples, side-by-side images and diffs are not built.", yue: "純參考檢視器、對應路由、截圖組合、並排圖同差異圖未做。" } },
  { id: "design-folder", state: "partial", title: { en: "Design files in the repository", yue: "設計檔案喺倉庫入面" },
    works: { en: "The boards, canvas index and theme are tracked under design/.", yue: "畫板、畫布索引同主題都喺 design/ 入面追蹤。" },
    missing: { en: "Boards for the new appearance screens (editor, motion, logo, accessibility menu) and their Tweaks and sticky notes are not drawn yet.", yue: "新外觀畫面（編輯器、動畫、標誌、無障礙選單）嘅畫板，以及佢哋嘅 Tweaks 同便利貼未畫。" } },
  { id: "clipping-matrix", state: "progress", title: { en: "Clipping matrix", yue: "裁切矩陣" },
    works: { en: "Wrapping and minimum-size rules are in the stylesheet.", yue: "樣式表有換行同最小尺寸規則。" },
    missing: { en: "The layout probe and screenshots at every viewport, language, theme and scale have not been run, so no clipping-free claim is made.", yue: "每個視窗大細、語言、主題同縮放嘅版面探測同截圖未跑，所以唔宣稱冇裁切。" } },
  { id: "vendored-fonts", state: "partial", title: { en: "Vendored fonts", yue: "內置字體" },
    works: { en: "Both fonts are served from this app, never from a remote address. A committed manifest records the SHA-256 of each file and the Fonts screen verifies the files against it.", yue: "兩款字體都由本程式提供，唔會用遠端位址。已提交嘅清單記錄每個檔案嘅 SHA-256，字體畫面會對照檢查。" },
    missing: { en: "The script that downloads from the font host with a modern browser identity is not written; the files come from pinned npm packages.", yue: "用現代瀏覽器身分向字體主機下載嘅腳本未寫；檔案來自已鎖定版本嘅 npm 套件。" } },
  { id: "app-icon", state: "progress", title: { en: "Original logo and packaged icon", yue: "原創標誌同封裝圖示" },
    works: { en: "An original router logo is the favicon and the default logo preset.", yue: "原創路由器標誌係網站圖示同預設標誌。" },
    missing: { en: "No multi-resolution .ico or packaged icon exists yet, because this app is not packaged as an installer.", yue: "未有多解像度 .ico 或封裝圖示，因為呢個程式未封裝成安裝程式。" } },
];

// The Material components the app uses, by surface, with the stylesheet class that draws each.
// A test checks that each class exists in the stylesheet and that no surface uses a bare control.
export const COMPONENTS = [
  { surface: "Navigation", component: "Navigation rail and tabs", classes: ["rail", "navi", "tabs", "tab"] },
  { surface: "Top bar", component: "Search, icon buttons, segmented language switch", classes: ["search", "icb", "seg"] },
  { surface: "Content", component: "Cards, headings, chips, tags", classes: ["card", "disp", "chip", "tag", "pill"] },
  { surface: "Settings", component: "Setting rows, switches, sliders, fields", classes: ["setting", "sw", "slider", "field", "ipv4"] },
  { surface: "Actions", component: "Filled, tonal, outlined and danger buttons", classes: ["btn"] },
  { surface: "Overlays", component: "Dialogs, toasts, notes, floating panels", classes: ["sheet", "toast", "note", "mo-panel"] },
  { surface: "Data", component: "Tables, meters, charts", classes: ["tbl", "meter", "chart", "lc-stage"] },
];
