// The setup checklist as plain data: the steps, which are optional, and how
// saved progress is read back. No imports.

export const STEPS = [
  { id: "router", optional: false, title: { en: "Check the router connection", yue: "檢查路由器連線" }, about: { en: "Shows where the app connects and times a real read from the router.", yue: "顯示程式連去邊度，同埋量度一次真實嘅路由器讀取。" } },
  { id: "guard", optional: true, title: { en: "Choose the safety timer", yue: "揀安全計時器" }, about: { en: "How long a risky change waits for you to confirm before it rolls back by itself.", yue: "有風險嘅改動等你確認幾耐，過咗就自動還原。" } },
  { id: "people", optional: true, title: { en: "See who can sign in", yue: "睇邊個可以登入" }, about: { en: "Lists the owner and any other accounts. Add more on the System screen.", yue: "列出擁有者同其他帳戶。要加人就去「系統」畫面。" } },
  { id: "finish", optional: false, title: { en: "Open the workspace", yue: "進入工作區" }, about: { en: "Everything is set. Go to the overview.", yue: "全部準備好，去概覽。" } },
];

export const emptyProgress = () => ({ step: 0, done: [], skipped: [] });

// Only known steps survive loading from storage.
export function sanitize(raw) {
  const ids = new Set(STEPS.map((s) => s.id));
  const list = (v) => (Array.isArray(v) ? v.filter((x) => ids.has(x)) : []);
  const step = Number.isInteger(raw?.step) && raw.step >= 0 && raw.step < STEPS.length ? raw.step : 0;
  return { step, done: list(raw?.done), skipped: list(raw?.skipped) };
}

export const complete = (p, id) => ({ ...p, done: [...new Set([...p.done, id])], skipped: p.skipped.filter((x) => x !== id) });
export function skip(p, id) {
  const step = STEPS.find((s) => s.id === id);
  return step?.optional ? { ...p, skipped: [...new Set([...p.skipped, id])] } : p;
}
export const percent = (p) => Math.round(((p.done.length + p.skipped.length) / STEPS.length) * 100);
export const guardValid = (n) => Number.isInteger(n) && n >= 20 && n <= 600;
