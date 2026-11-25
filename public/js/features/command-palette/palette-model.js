// The list the palette searches, built from the app's own data, plus the
// scoring that orders results. No imports, so tests can run it directly.

const text = (label) => `${label?.en ?? ""}
${label?.yue ?? ""}`;

// pages: catalogue domains and feature screens; settings: catalogue entries;
// commands: [{ id, label, icon, keywords, run, kind? }] from the app and features.
export function buildItems({ domains = [], featureScreens = {}, entries = [], commands = [], canWrite = true }) {
  const items = [];
  const seen = new Set();
  const page = (d, group) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    items.push({ key: `page:${d.id}`, kind: "page", id: d.id, icon: d.icon ?? "chevron_right", label: d.label, where: group ?? d.group ?? { en: "Screen", yue: "畫面" }, haystack: `${text(d.label)}
${d.id}` });
  };
  for (const d of domains) page(d);
  for (const d of Object.values(featureScreens)) page(d);
  for (const e of entries) {
    const locked = !canWrite || Boolean(e.disabled) || e.readOnly;
    items.push({
      key: `setting:${e.id}`, kind: "setting", id: e.id, entry: e, domain: e.domain, icon: "tune", label: e.label,
      where: e.groupLabel ?? { en: e.domain, yue: e.domain },
      locked,
      lockedReason: !canWrite ? { en: "Your account can only view settings.", yue: "你嘅帳戶只可以睇設定。" } : e.disabled ? e.disabled : e.readOnly ? { en: "This value is read only.", yue: "呢個值只可以讀取。" } : null,
      haystack: `${text(e.label)}
${text(e.help)}
${e.key}
${e.id}`,
    });
  }
  for (const c of commands) {
    if (seen.has(`command:${c.id}`)) continue;
    seen.add(`command:${c.id}`);
    items.push({ key: `command:${c.id}`, kind: c.kind ?? "command", id: c.id, icon: c.icon ?? "bolt", label: c.label, where: c.kind === "appearance" ? { en: "Appearance", yue: "外觀" } : { en: "Command", yue: "指令" }, run: c.run, render: c.render, haystack: `${text(c.label)}
${c.keywords ?? ""}
${c.id}` });
  }
  return items;
}

// Words match in any order; the label counts more than the rest. test(string)
// is used instead when the search box is in regex mode.
export function rank(items, query, test = null) {
  const q = String(query ?? "").trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const scored = [];
  items.forEach((item, index) => {
    let score = 0;
    if (test) score = test(item.label.en) || test(item.label.yue) || test(item.haystack) ? 1 : -1;
    else if (!words.length) score = item.kind === "page" ? 3 : item.kind === "command" || item.kind === "appearance" ? 2 : 1;
    else {
      const label = text(item.label).toLowerCase();
      const hay = item.haystack.toLowerCase();
      if (!words.every((w) => hay.includes(w))) score = -1;
      else score = 1 + (label.startsWith(q) ? 6 : 0) + words.filter((w) => label.includes(w)).length * 2 + (item.kind === "page" ? 1 : 0);
    }
    if (score > 0) scored.push([score, index, item]);
  });
  return scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((s) => s[2]);
}
