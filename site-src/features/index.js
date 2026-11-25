/* Entry point for the documentation site features. Loaded once per page as a module. */
if (!window.__MAR_FEATURES) {
  window.__MAR_FEATURES = true;
  boot();
}
async function boot() {
  const core = await import('./core.js');
  const { root, h, define, get, set, applyAll, siteRoot, $ } = core;
  // Styles first, so nothing flashes unstyled.
  const base = new URL('./', import.meta.url).href;
  const link = h('link', { rel: 'stylesheet', href: base + 'features.css' }); document.head.append(link);
  const [, , , voice, modes, appearance, locks, records, nav, settingsPage, onboarding, notifyMod] = await Promise.all([
    import('./strings.js'), import('./rx.js'), import('./sound.js'), import('./voice.js'), import('./modes.js'), import('./appearance.js'), import('./locks.js'), import('./records.js'), import('./nav.js'), import('./settings-page.js'), import('./onboarding.js'), import('./notify.js'),
  ]);
  const store = core.store;

  // Settings that already exist in the site chrome are mirrored here so the Settings page covers everything.
  const stamp = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  define({ id: 'theme', group: 'appearance', type: 'select', default: 'system', label: ['Colour theme', '顏色主題'], info: ['Light, dark, or follow your device.', '淺色、深色，或者跟隨你嘅裝置。'], options: [['light', 'Light', '淺色'], ['dark', 'Dark', '深色'], ['system', 'Follow my device', '跟隨裝置']], read: () => root.getAttribute('data-theme') || 'system', apply(v, o) { if (o && o.boot) return; root.setAttribute('data-theme', v); stamp('mar.theme', v); }, reset() { root.setAttribute('data-theme', 'system'); stamp('mar.theme', 'system'); } });
  define({ id: 'motion', group: 'motion', type: 'select', default: 'full', label: ['Motion', '動態'], info: ['Full plays all animation. Reduced keeps only gentle fades. None turns animation off. Reduced and None always win over the animation editor.', '全部會播放所有動畫，減少只保留柔和淡入淡出，無就完全冇動畫。減少同無永遠優先於動畫編輯器。'], options: [['full', 'Full', '全部'], ['reduced', 'Reduced', '減少'], ['none', 'None', '無']], read: () => root.getAttribute('data-motion') || 'full', apply(v, o) { if (o && o.boot) return; root.setAttribute('data-motion', v); stamp('mar.motion', v); core.emit('setting', { id: 'motion', value: v }); }, reset() { root.setAttribute('data-motion', 'full'); stamp('mar.motion', 'full'); } });
  // Shortcut actions, so every command is also a setting row the palette and the Settings page can reach.
  define({ id: 'act.palette', group: 'navigation', type: 'action', label: ['Open the command palette', '開啟命令面板'], info: ['Search every command, page and setting. Shortcut: Ctrl+Shift+F or Ctrl+K.', '搜尋所有命令、頁面同設定。快速鍵：Ctrl+Shift+F 或 Ctrl+K。'], run: nav.openPalette });
  define({ id: 'act.catalog', group: 'navigation', type: 'action', label: ['Open the New tab catalog', '開啟新分頁目錄'], info: ['Lists every page and destination, with its own search and regex builder. Shortcut: Alt+Shift+T.', '列出所有頁面同目的地，附自己嘅搜尋同正規表達式建構器。快速鍵：Alt+Shift+T。'], run: () => nav.openCatalog() });
  define({ id: 'act.opentabs', group: 'navigation', type: 'action', label: ['Open every tab', '開啟所有分頁'], info: ['Reopens every page as a tab, including tabs you closed.', '將所有頁面重新用分頁開啟，包括你關閉咗嘅。'], run: nav.openEveryTab });
  define({ id: 'act.shortcuts', group: 'navigation', type: 'action', label: ['Show keyboard shortcuts', '顯示鍵盤快速鍵'], info: ['A table of every shortcut. Press ? on any page.', '所有快速鍵嘅列表。喺任何頁面按 ? 都得。'], run: nav.showShortcuts });
  define({ id: 'act.notes', group: 'navigation', type: 'action', label: ['Open the notification centre', '開啟通知中心'], info: ['Every notification is kept here, with search, filters and mark as read.', '所有通知都保留喺呢度，可以搜尋、篩選同標為已讀。'], run: notifyMod.openCentre });
  define({ id: 'act.narrate', group: 'narration', type: 'action', label: ['Read this page aloud', '朗讀呢一頁'], info: ['Starts or stops reading the open page. Shortcut: Alt+Shift+N.', '開始或者停止朗讀目前嘅頁面。快速鍵：Alt+Shift+N。'], run: voice.toggleReading });
  define({ id: 'act.lock', group: 'safety', type: 'action', label: ['Pick an element to lock', '揀要鎖住嘅元素'], info: ['Click any element on a page to start the lock wizard. Pressing Escape cancels.', '喺頁面點擊任何元素開始鎖定精靈，按 Esc 取消。'], run: locks.pickElement });

  applyAll();
  records.initRecords(); voice.initVoice(); appearance.initAppearance(); modes.initModes(); locks.initLocks(); await nav.initNav(); notifyMod.refreshBadge();
  // Re-apply the document language attributes after the language radios in older chrome may have changed.
  const host = document.getElementById('mf-settings');
  if (host) { settingsPage.renderSettings(host); document.addEventListener('mar:lang', () => settingsPage.renderSettings(host)); }
  onboarding.maybeWelcome();
  document.documentElement.setAttribute('data-mf-ready', '');
}
