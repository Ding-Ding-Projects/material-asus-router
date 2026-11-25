// Guest networks screen: an overview of every guest network on every band, then
// one card per network with all of its settings (name, security, access time,
// intranet access, bandwidth limit, device cap). Edits queue in the dock.
//
// This file imports nothing: everything it needs arrives in ctx.

const label = { en: "Guest networks", yue: "訪客網絡" };
const lede = {
  en: "Up to three guest networks on each band, each with its own password, time limit, intranet access and speed cap.",
  yue: "每個頻段最多三個訪客網絡，每個都有自己嘅密碼、時間限制、內部網絡存取同限速。",
};

const ORDER = ["enabled", "ssid", "password", "lan", "auth", "hidden", "expire", "maxassoc", "bw-on", "bw-down", "bw-up"];
const suffix = (id) => id.split(".").slice(-1)[0];
const bandText = (nband) => ({ 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz" })[nband] ?? "Wi-Fi";

const hours = (seconds) => (seconds === 0 ? null : seconds >= 86400 ? `${seconds / 86400} d` : seconds >= 3600 ? `${seconds / 3600} h` : `${Math.round(seconds / 60)} min`);

const readBand = () => {
  try {
    return localStorage.getItem("wifi-guest-plus.band");
  } catch {
    return null;
  }
};
const saveBand = (value) => {
  try {
    localStorage.setItem("wifi-guest-plus.band", value);
  } catch {
    // Storage can be blocked in a private window; the screen still works.
  }
};

async function render(ctx) {
  const { h, icon, t, tt } = ctx;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const body = h("div", { class: "gp-body" });
  page.append(body);
  let data;
  let band = null;

  const load = async () => {
    data = await ctx.api.get("/api/domain/wifi-guest-plus");
    if (!data.bands.some((b) => String(b.index) === band)) band = data.bands.some((b) => String(b.index) === readBand()) ? readBand() : String(data.bands[0]?.index ?? 0);
  };

  const tag = (text, tone = "") => h("span", { class: `tag ${tone}` }, text);

  const overview = () =>
    h("section", { class: "card rise tone" },
      h("h2", { class: "h2" }, t("All guest networks", "所有訪客網絡")),
      h("div", { class: "gp-grid" },
        data.networks.map((n) =>
          h("button", { type: "button", class: `gp-net ${n.on ? "on" : ""} ${String(n.band) === band ? "sel" : ""}`, "aria-pressed": String(String(n.band) === band),
            "aria-label": `${bandText(n.nband)}, ${t("guest network", "訪客網絡")} ${n.number}, ${n.on ? t("on", "開") : t("off", "關")}`,
            onClick() { band = String(n.band); saveBand(band); draw(); } },
            h("div", { class: "k" }, `${bandText(n.nband)} · ${n.number}`),
            h("div", { class: "gp-name" }, n.ssid || "—"),
            h("div", { class: "gp-tags" },
              tag(n.on ? t("On", "開") : t("Off", "關"), n.on ? "good" : ""),
              n.on && n.open ? tag(t("Open", "開放"), "warn") : null,
              n.on && n.intranet ? tag(t("Sees home devices", "見到屋企裝置"), "bad") : null,
              n.on && hours(n.expireSeconds) ? tag(hours(n.expireSeconds)) : null,
              n.on && n.limited ? tag(t("Speed cap", "限速")) : null)))),
      h("div", { class: "actions" },
        h("button", { class: "btn o", type: "button", disabled: !ctx.state.canWrite || !data.networks.some((n) => n.on), onClick() {
          let queued = 0;
          for (const n of data.networks.filter((x) => x.on)) {
            const id = n.number === 1 ? `wl${n.band}.1.enabled` : `wifi-guest-plus.wl${n.band}.${n.number}.enabled`;
            const entry = [...data.stock, ...data.entries].find((e) => e.id === id);
            if (entry && !entry.disabled) { ctx.dock.setEntry(entry, "0"); queued += 1; }
          }
          ctx.toast(t(`${queued} guest networks queued to switch off. Review them in the changes bar.`, `已排咗 ${queued} 個訪客網絡關閉。請喺改動列檢視。`));
          draw();
        } }, icon("wifi_off", "sm"), t("Switch every guest network off", "關閉所有訪客網絡"))));

  const guestCard = (b, n) => {
    const pool = n === 1
      ? [...data.stock.filter((e) => e.id.startsWith(`wl${b.index}.1.`)), ...data.entries.filter((e) => e.id.startsWith(`wifi-guest-plus.wl${b.index}.1.`))]
      : data.entries.filter((e) => e.id.startsWith(`wifi-guest-plus.wl${b.index}.${n}.`));
    pool.sort((x, y) => ORDER.indexOf(suffix(x.id)) - ORDER.indexOf(suffix(y.id)));
    const net = data.networks.find((x) => x.band === b.index && x.number === n);
    const risky = net?.on && net.intranet;
    const card = ctx.controls.groupCard({ en: `Guest network ${n}`, yue: `訪客網絡 ${n}` }, pool);
    if (card && risky) card.insertBefore(h("div", { class: "note warn" }, icon("warning"), t("Guests on this network can reach your home devices. Turn intranet access off unless you mean it.", "呢個網絡嘅訪客可以接觸你嘅屋企裝置。除非你有意，否則請關閉內部網絡存取。")), card.children[1] ?? null);
    return card;
  };

  const progress = () =>
    h("section", { class: "card rise tone" },
      h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "仲未完成")),
      h("ul", { class: "gp-list" },
        h("li", {}, t("How much of a timed guest session is left is not shown yet. The limit is applied by the router; this screen shows the limit you chose.", "計時訪客仲剩幾多時間暫時未顯示。限時由路由器執行；呢度顯示你揀嘅限制。")),
        h("li", {}, t("A per-guest list of connected devices is not drawn here. Use the Devices screen, which lists every device and its band.", "暫時未有每個訪客網絡嘅已連接裝置清單。請用「裝置」畫面，裡面有每部裝置同佢嘅頻段。")),
        h("li", {}, t("Bandwidth limits are set in kilobits per second and proved against the pretend router only. Confirm them on your model.", "頻寬限制以 kbps 計，只喺模擬路由器證實過。請喺你部型號確認。"))));

  const draw = () => {
    ctx.clear(body);
    const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Choose a band", "揀頻段") },
      data.bands.map((b) => h("button", { role: "radio", "aria-checked": String(String(b.index) === band), class: String(b.index) === band ? "on" : "", onClick() { band = String(b.index); saveBand(band); draw(); } }, bandText(b.nband))));
    const b = data.bands.find((x) => String(x.index) === band);
    body.append(overview(), tabs);
    if (b) for (const n of [1, 2, 3]) body.append(guestCard(b, n));
    body.append(progress());
  };

  try {
    await load();
    draw();
  } catch (error) {
    body.append(h("div", { class: "note bad" }, icon("error"), error.message));
    return undefined;
  }
  return ctx.bus.on("changed", async () => {
    try {
      await load();
      draw();
    } catch {
      // The next navigation will show the problem.
    }
  });
}

export default {
  id: "wifi-guest-plus",

  screens: [{ id: "wifi-guest-plus", group: { en: "Network", yue: "網絡" }, icon: "group", label, render }],

  settings: [
    {
      id: "wifi-guest-plus",
      icon: "group",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/wifi-guest-plus");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],

  commands: [
    { id: "wifi-guest-plus.open", icon: "group", label: { en: "Open guest networks", yue: "開啟訪客網絡" }, keywords: "guest visitor wifi time limit bandwidth intranet", run: (ctx) => ctx.navigate("wifi-guest-plus") },
  ],
};
