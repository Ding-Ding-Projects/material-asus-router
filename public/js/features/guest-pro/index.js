// Guest Network Pro: shows where each guest Wi-Fi lands (home network or its
// own separate network), the VLAN and addresses it uses and how many visitors
// are on it right now, then the rich controls to change them. The map follows
// the changes waiting in the dock and the visitor count refreshes while the
// page is open. Stock ASUS firmware only; on Merlin the controls are shown
// switched off with the reason.
import { bridgeName, countsOf, guestMap, prefixOf } from "./model.js";

const label = { en: "Guest Network Pro", yue: "訪客網絡 Pro" };
const lede = { en: "Give visitors their own separate network, so they get the internet and nothing else in your home.", yue: "俾訪客一個獨立網絡，佢哋可以上網，但碰唔到屋企其他嘢。" };
const POLL_MS = 4000;

const ADVICE = {
  off: { icon: "wifi_off", tone: "", en: "Off. Nobody can join.", yue: "已關閉，冇人連到。" },
  shared: { icon: "warning", tone: "warn", en: "Visitors share the home network. Pick a separate guest network.", yue: "訪客同屋企用同一個網絡。請揀獨立訪客網絡。" },
  visible: { icon: "visibility", tone: "warn", en: "Separate from home, but visitors can see each other.", yue: "同屋企分隔咗，但訪客之間睇到對方。" },
  safe: { icon: "verified_user", tone: "good", en: "Separate from home, and visitors cannot see each other.", yue: "同屋企分隔，而且訪客之間睇唔到對方。" },
};

export default {
  id: "guest-pro",

  screens: [
    {
      id: "guest-pro",
      group: { en: "Network", yue: "網絡" },
      icon: "hub",
      label,
      async render(ctx) {
        const { h, icon, t, tt } = ctx;
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        const data = await ctx.api.get("/api/domain/guest-pro");
        let counts = new Map();
        let liveAt = "";
        const offs = [];

        if (data.reason) page.append(h("div", { class: "note warn" }, icon("info"), tt(data.reason)));

        const mapBody = h("div", { class: "gp-map", "aria-live": "polite" });
        let entered = false;
        const last = new Map();
        const pendingKeys = () => new Map(data.entries.filter((e) => ctx.dock.has(e.id)).map((e) => [e.key, ctx.dock.value(e.id)]));
        const drawMap = () => {
          const lines = guestMap(data.nets, data.vlans, data.subnets, counts, pendingKeys());
          ctx.clear(mapBody);
          for (const [i, line] of lines.entries()) {
            const advice = ADVICE[line.advice];
            const bridge = bridgeName(line.bridge);
            const detail = [
              line.vlan ? t(`VLAN ${line.vlan.vid}`, `VLAN ${line.vlan.vid}`) : null,
              line.subnet ? `${line.subnet.gateway}/${prefixOf(line.subnet.mask) ?? "?"}` : null,
              line.subnet ? (line.subnet.dhcp ? t("hands out addresses", "自動派地址") : t("fixed addresses only", "淨係固定地址")) : null,
            ].filter(Boolean).join(" · ");
            mapBody.append(h("div", { class: `gp-line ${line.on ? "" : "off"} ${entered ? "" : "gp-enter"}`, "data-net": line.id, "data-delay": String(i) },
              h("div", { class: "gp-ssid" }, icon(line.on ? "wifi" : "wifi_off", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, line.ssid || t("Not set up", "未設定")), h("div", { class: "t2 mono" }, line.id))),
              h("div", { class: `gp-link ${line.separate ? "sep" : "shared"}`, "aria-hidden": "true" }, h("span", { class: "gp-wire" }), icon("arrow_forward", "sm")),
              h("div", { class: "gp-dest" }, h("div", { class: "t1" }, tt(bridge)), h("div", { class: "t2" }, detail || t("No separate addresses", "冇獨立地址"))),
              h("div", { class: "gp-count", role: "status", "aria-label": t(`${line.clients} visitors connected`, `${line.clients} 位訪客已連線`) }, icon("devices", "sm"), h("span", { class: `gp-num ${last.get(line.id) !== undefined && last.get(line.id) !== line.clients ? "bump" : ""}`, "data-n": String(line.clients) }, String(line.clients))),
              h("div", { class: `gp-advice ${advice.tone}` }, icon(advice.icon, "sm"), t(advice.en, advice.yue))));
          }
          entered = true;
          for (const line of lines) last.set(line.id, line.clients);
        };
        const mapCard = h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("account_tree", "sm"), " ", t("Where each guest Wi-Fi lands", "每個訪客 Wi-Fi 去咗邊")), mapBody,
          h("div", { class: "t2 gp-stamp", role: "status" }));
        page.append(mapCard);
        drawMap();
        offs.push(ctx.bus.on("dock", drawMap));

        const stamp = mapCard.querySelector(".gp-stamp");
        let busy = false;
        const poll = async () => {
          if (busy || document.hidden) return;
          busy = true;
          try {
            const out = await ctx.api.get("/api/x/guest-pro/clients");
            counts = countsOf(out);
            liveAt = new Date(out.at).toLocaleTimeString([], { hour12: false });
            stamp.textContent = t(`Live. Last read ${liveAt}.`, `即時。上次讀取 ${liveAt}。`);
            drawMap();
          } catch {
            stamp.textContent = t("The visitor count could not be read just now. Trying again.", "暫時讀唔到訪客數目，會再試。");
          }
          busy = false;
        };
        poll();
        const timer = setInterval(poll, POLL_MS);
        offs.push(() => clearInterval(timer));

        for (const group of ctx.controls.settingGroups(data.entries)) {
          const card = ctx.controls.groupCard(group.label, group.entries);
          card.classList.add("rise");
          page.append(card);
        }
        const notes = data.entries.filter((e) => e.meta?.note && !e.disabled);
        if (notes.length) page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "進行中")), h("div", { class: "t2" }, tt(notes[0].meta.note))));
        return () => offs.forEach((off) => off());
      },
    },
  ],

  commands: [
    { id: "guest-pro.open", icon: "hub", label: { en: "Open Guest Network Pro", yue: "開啟訪客網絡 Pro" }, keywords: "guest visitors vlan isolate separate network 訪客 分隔", run: (ctx) => ctx.navigate("guest-pro") },
  ],
};
