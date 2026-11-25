// The setup checklist as plain data: the steps, which are optional, and how
// saved progress is read back. No imports.

export const STEPS = [
  { id: "owner", optional: false, title: { en: "Your account", yue: "你嘅帳戶" }, about: { en: "Shows who you are signed in as. The first account on a fresh install is the owner.", yue: "顯示你登入嘅身份。全新安裝嘅第一個帳戶就是擁有者。" } },
  { id: "router", optional: false, title: { en: "Router address", yue: "路由器地址" }, about: { en: "Where the app connects, and which SSH port the router listens on.", yue: "程式連去邊度，同埋路由器用邊個 SSH 連接埠。" } },
  { id: "login", optional: false, title: { en: "SSH sign-in", yue: "SSH 登入" }, about: { en: "How the app signs in: a password used once for the test, or the app's own key.", yue: "程式點樣登入：只測試一次嘅密碼，或者程式自己嘅金鑰。" } },
  { id: "test", optional: false, title: { en: "Test the connection", yue: "測試連線" }, about: { en: "Connects for real, times a read from the router and approves its host key.", yue: "真正連線、量度一次路由器讀取，同埋核准主機金鑰。" } },
  { id: "guard", optional: true, title: { en: "Choose the safety timer", yue: "揀安全計時器" }, about: { en: "How long a risky change waits for you to confirm before it rolls back by itself.", yue: "有風險嘅改動等你確認幾耐，過咗就自動還原。" } },
  { id: "people", optional: true, title: { en: "See who can sign in", yue: "睇邊個可以登入" }, about: { en: "Lists the owner and any other accounts. Add more on the System screen.", yue: "列出擁有者同其他帳戶。要加人就去「系統」畫面。" } },
  { id: "polling", optional: true, title: { en: "How often to check", yue: "檢查頻率" }, about: { en: "How often the app asks the router for fresh numbers.", yue: "程式幾耐問路由器攞一次最新數字。" } },
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
