// Merlin add-ons: what lives in /jffs/addons (the folder amtm and the popular
// add-ons use), shown as read-only status cards. A card can launch the
// add-on's own version command, but only from a short reviewed table, never
// from anything typed in the browser. Nothing here installs, updates, removes
// or configures an add-on.
import { L } from "../kit.mjs";
import { handler as fakeHandler } from "./fake.mjs";

const ID = "addons";
const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// The reviewed table. key = folder name in lower case without ".d".
export const KNOWN = {
  amtm: { name: "amtm", about: L("The add-on manager menu that installs and updates the others. It is interactive, so open it in the terminal.", "安裝同更新其他附加程式嘅選單。佢係互動式，請喺終端機開啟。"), script: null },
  spdmerlin: { name: "spdMerlin", about: L("Runs internet speed tests on a schedule and charts them.", "定時做上網速度測試並畫成圖。"), script: "/jffs/scripts/spdmerlin" },
  connmon: { name: "connmon", about: L("Watches the internet connection with regular pings.", "定時 ping 嚟監察上網連線。"), script: "/jffs/scripts/connmon" },
  ntpmerlin: { name: "ntpMerlin", about: L("Charts how far the router's clock drifts.", "畫出路由器時鐘偏差。"), script: "/jffs/scripts/ntpmerlin" },
  uidivstats: { name: "uiDivStats", about: L("Shows Diversion ad-blocking statistics on the router's page.", "喺路由器網頁顯示 Diversion 攔截廣告統計。"), script: "/jffs/scripts/uidivstats" },
  yazfi: { name: "YazFi", about: L("Extra guest Wi-Fi networks with their own rules.", "有獨立規則嘅額外訪客 Wi-Fi。"), script: "/jffs/scripts/YazFi" },
  scmerlin: { name: "scMerlin", about: L("Shows and restarts the router's services from its web page.", "喺路由器網頁顯示同重啟服務。"), script: "/jffs/scripts/scmerlin" },
  uiscribe: { name: "uiScribe", about: L("Shows the system log, split by program, on the router's page.", "喺路由器網頁按程式分開顯示系統記錄。"), script: "/jffs/scripts/uiscribe" },
};

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/;
const keyOf = (dir) => dir.toLowerCase().replace(/\.d$/, "");

async function listAddons(exec) {
  const out = await exec("ls -1 /jffs/addons");
  if (out.code !== 0) return [];
  const names = out.stdout.split("\n").map((l) => l.trim()).filter((n) => NAME.test(n));
  const cards = [];
  for (const dir of names) {
    const key = keyOf(dir);
    const known = KNOWN[key] ?? null;
    const size = Number.parseInt((await exec(`du -sk /jffs/addons/${dir}`)).stdout, 10);
    let runnable = false;
    if (known?.script) runnable = (await exec(`test -x ${known.script} && echo yes || echo no`)).stdout.trim() === "yes";
    cards.push({ key, folder: dir, name: known?.name ?? dir.replace(/\.d$/, ""), about: known?.about ?? L("An add-on this app does not know. Only its folder is shown.", "呢個程式未認識嘅附加程式，只顯示佢嘅資料夾。"), known: Boolean(known), sizeKb: Number.isInteger(size) ? size : null, command: runnable ? `${known.script} version` : null, runnable });
  }
  return cards;
}

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "extension", label: L("Merlin add-ons", "Merlin 附加程式"), group: { en: "Power tools", yue: "進階工具" }, firmware: "merlin", live: true }],
  domains: {
    [ID]: async (ctx) => {
      const addons = await listAddons(ctx.exec);
      const scripts = (await ctx.exec("ls -1 /jffs/scripts")).stdout.split("\n").map((l) => l.trim()).filter((n) => NAME.test(n));
      return { addons, amtm: addons.some((a) => a.key === "amtm"), scripts, reviewed: Object.keys(KNOWN) };
    },
  },
  routes(api) {
    // Runs the add-on's own version command from the reviewed table.
    api.post("/status", async ({ body, live }) => {
      const key = String(body.key ?? "");
      const known = Object.hasOwn(KNOWN, key) ? KNOWN[key] : null;
      if (!known?.script) throw bad("This add-on has no reviewed status command.", 404, { code: "NO_COMMAND" });
      const ctx = await live();
      const present = (await listAddons(ctx.exec)).find((a) => a.key === key);
      if (!present) throw bad("That add-on is not installed.", 404);
      if (!present.runnable) throw bad("The add-on's script is not on the router.", 409, { code: "NO_SCRIPT" });
      const command = `${known.script} version`;
      const out = await ctx.exec(command, { timeoutMs: 20000 });
      return { key, command, code: out.code, output: `${out.stdout}${out.stderr}`.slice(0, 20000), at: new Date().toISOString() };
    });
  },
  fakeRouter: { handlers: [fakeHandler] },
};
