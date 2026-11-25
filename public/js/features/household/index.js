// The household: who lives here, when they are at work, asleep or at home,
// and how much disturbance they put up with ("Most brother madness allowed").
// Presence comes only from which home Wi-Fi network a device is connected to
// and from Home Assistant entities the owner picks; nothing is tracked or kept.
// It also carries the "Who is using the most" tab, which ranks devices and
// people by upload and download.
import { api, bus, clear, h, icon, request, t, tt, toast } from "../../core.js";
import { levelBadge, loadSafety, refreshAllowance, safety } from "../change-safety/safety.js";
import { LEVEL_WORDS, presenceText, wiredOnlyNote } from "./model.js";
import { memberCard } from "./people.js";
import { talkersPanel } from "./talkers.js";

const label = { en: "Household", yue: "屋企" };
const talkersLabel = { en: "Top talkers", yue: "邊個用最多" };
const errText = (e) => e?.message ?? String(e);
const TABS = [["people", "groups", "People", "人"], ["presence", "sensors", "Who is home", "邊個喺屋企"], ["homeassistant", "home_iot_device", "Home Assistant", "Home Assistant"], ["networks", "wifi", "Home Wi-Fi", "屋企 Wi-Fi"], ["talkers", "swap_vert", "Who uses the most", "邊個用最多"]];

function madnessCard(data, owner, after) {
  const buttons = LEVEL_WORDS.map((w, i) => h("button", { type: "button", role: "radio", "aria-checked": String(data.madness === i), class: data.madness === i ? "on" : "", disabled: !owner, onClick: async () => {
    try { await put("/api/household", { madness: i }); data.madness = i; toast(t("Saved.", "已儲存。")); after(); } catch (error) { toast(errText(error), "bad"); }
  } }, levelBadge(i, { label: false }), " ", tt(w)));
  return h("section", { class: "card rise" },
    h("h2", { class: "h2" }, icon("family_restroom", "sm"), " ", t("Most brother madness allowed", "最多容許你兄弟幾火")),
    h("p", { class: "t2" }, t("The household’s own limit. A change that would disturb the house more than this is refused until the owner overrides it with the four keys. Each person can be stricter or looser below.", "屋企自己嘅上限。如果改動對屋企嘅影響大過呢個級數，就會被拒絕，除非擁有人用四把匙覆寫。每個人可以喺下面設得更嚴或者更鬆。")),
    h("div", { class: "seg madness", role: "radiogroup", "aria-label": t("Most brother madness allowed", "最多容許你兄弟幾火") }, buttons),
    owner ? null : h("div", { class: "muted" }, t("Only the owner can change this.", "只有擁有人可以修改。")));
}
const put = (url, body) => request("PUT", url, body);

async function render(ctx, start = "people") {
  const root = ctx.root;
  const page = h("div", { class: "page" });
  root.append(page);
  const state = { tab: start, data: null, devices: [], entities: [], presence: null, allowance: null, networks: [] };
  let stopTalkers = null;
  let timer = null;
  const body = h("div", { class: "hh-body" });
  const tabs = h("div", { class: "seg tabs-in", role: "tablist", "aria-label": t("Household views", "屋企檢視") });

  const load = async () => {
    state.data = await api.get("/api/household");
    const [devices, networks, presence, allowance] = await Promise.all([api.get("/api/household/devices").catch(() => ({ devices: [] })), api.get("/api/household/networks").catch(() => ({ networks: [] })), api.get("/api/household/presence").catch(() => null), api.get("/api/household/allowance").catch(() => null)]);
    state.devices = devices.devices ?? [];
    state.networks = networks.networks ?? [];
    state.presence = presence;
    state.allowance = allowance;
    state.entities = [];
    if (safety.owner && state.data.ha?.hasToken) state.entities = (await api.get("/api/household/homeassistant/entities").catch(() => ({ entities: [] }))).entities ?? [];
  };

  function peopleView() {
    const o = safety.owner;
    return [
      madnessCard(state.data, o, () => { refreshAllowance(); drawBody(); }),
      state.data.members.map((m) => memberCard(m, { owner: o, devices: state.devices, entities: state.entities, presets: state.data.presets ?? [], reload: reloadAll })),
      o ? h("section", { class: "card" }, h("h2", { class: "h2" }, t("Add a person", "加一個人")), addPerson()) : null,
    ];
  }
  function addPerson() {
    const input = { name: "", nameYue: "" };
    return h("div", { class: "grid2" },
      h("label", { class: "field" }, h("span", {}, t("Name", "名稱")), h("input", { type: "text", maxlength: "60", onInput: (e) => (input.name = e.target.value) })),
      h("label", { class: "field" }, h("span", {}, t("Cantonese name", "廣東話名稱")), h("input", { type: "text", maxlength: "60", onInput: (e) => (input.nameYue = e.target.value) })),
      h("button", { class: "btn f", onClick: async () => { try { await api.post("/api/household/members", input); reloadAll(); } catch (error) { toast(errText(error), "bad"); } } }, icon("person_add", "sm"), t("Add", "加")));
  }

  function presenceView() {
    const p = state.presence;
    if (!p) return h("div", { class: "note warn" }, icon("info"), h("div", {}, t("Presence could not be read.", "讀唔到邊個喺屋企。")));
    return [
      state.allowance ? h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Right now", "而家")), h("div", { class: "row" }, levelBadge(state.allowance.allowed), h("div", { class: "grow" }, state.allowance.configured ? t(`The household allows up to Level ${state.allowance.allowed}.`, `屋企依家最多容許級數 ${state.allowance.allowed}。`) : t("Nobody is set up yet, so the household limit applies as it is.", "仲未設定任何人，所以直接用屋企上限。")))) : null,
      p.members.map((m) => {
        const text = presenceText(m);
        const member = state.data.members.find((x) => x.id === m.id);
        return h("section", { class: `card rise presence ${text.tone}` }, h("div", { class: "row" }, icon(text.tone === "home" ? "home" : text.tone === "away" ? "directions_walk" : "help", "lg"), h("div", { class: "grow" }, h("div", { class: "t1" }, t(text.en, text.yue)),
          member && wiredOnlyNote(member, state.devices) ? h("div", { class: "note warn" }, icon("cable"), h("div", {}, t("These devices are wired, so the router cannot see whether anyone is home. Add a phone, or use Home Assistant.", "呢啲裝置係有線，路由器睇唔到有冇人喺屋企。請加一部手機，或者用 Home Assistant。"))) : null,
          m.state === "unknown" && m.configured ? h("div", { class: "t2" }, t("Unknown counts as home, the careful guess.", "唔知就當喺屋企，呢個係穩陣嘅估計。")) : null)));
      }),
      h("p", { class: "t2" }, t(`Home Wi-Fi networks read: ${p.networks.map((n) => `${n.ssid || n.ifname} (${n.clients})`).join(", ") || "none"}. Presence is read fresh each time and never stored.`, `讀取嘅屋企 Wi-Fi：${p.networks.map((n) => `${n.ssid || n.ifname}（${n.clients}）`).join("、") || "冇"}。每次都重新讀取，唔會儲存。`)),
    ];
  }

  function haView() {
    const o = safety.owner;
    const ha = state.data.ha ?? {};
    const input = { url: ha.url ?? "", token: "" };
    const result = h("div", { class: "t2", role: "status" });
    return h("section", { class: "card rise" },
      h("h2", { class: "h2" }, icon("home_iot_device", "sm"), " ", t("Connect Home Assistant", "連接 Home Assistant")),
      h("p", { class: "t2" }, t("Optional. Home Assistant can say whether a person is home. Create a long-lived access token in your Home Assistant profile and paste it here. It is stored on this server in the vault and is never shown again.", "可選。Home Assistant 可以話畀我哋知邊個喺屋企。喺 Home Assistant 個人檔案建立長期存取權杖再貼喺度。權杖會存喺呢部伺服器嘅保險庫，之後唔會再顯示。")),
      h("label", { class: "field" }, h("span", {}, t("Address", "地址")), h("input", { type: "url", value: input.url, disabled: !o, placeholder: "http://homeassistant.local:8123", onInput: (e) => (input.url = e.target.value) })),
      h("label", { class: "field" }, h("span", {}, t("Access token", "存取權杖")), h("input", { type: "password", autocomplete: "off", disabled: !o, placeholder: ha.hasToken ? t("A token is saved. Leave empty to keep it.", "已儲存權杖，留空會保留。") : "", onInput: (e) => (input.token = e.target.value) })),
      h("div", { class: "actions" },
        h("button", { class: "btn t", disabled: !o || !ha.hasToken, onClick: async () => { try { const out = await api.post("/api/household/homeassistant/test", {}); result.textContent = t(`Connected. ${out.entities} entities found.`, `已連接，搵到 ${out.entities} 個實體。`); } catch (error) { result.textContent = errText(error); } } }, icon("wifi_find", "sm"), t("Test", "測試")),
        h("button", { class: "btn f", disabled: !o, onClick: async () => { try { await put("/api/household/homeassistant", { url: input.url, token: input.token || undefined }); toast(t("Saved.", "已儲存。")); reloadAll(); } catch (error) { toast(errText(error), "bad"); } } }, icon("save", "sm"), t("Save", "儲存"))),
      result,
      state.entities.length ? h("div", { class: "t2" }, t(`${state.entities.length} entities available to pick in each person's card.`, `每個人嘅卡片可以揀 ${state.entities.length} 個實體。`)) : null,
      o ? null : h("div", { class: "muted" }, t("Only the owner can change this.", "只有擁有人可以修改。")));
  }

  function networksView() {
    const o = safety.owner;
    const data = state.data.homeNetworks ?? { guest: false, picked: null };
    const picked = new Set(data.picked ?? state.networks.filter((n) => n.home).map((n) => n.ifname));
    const save = async (patch) => { try { await put("/api/household", { homeNetworks: { ...data, ...patch } }); toast(t("Saved.", "已儲存。")); reloadAll(); } catch (error) { toast(errText(error), "bad"); } };
    return [
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("wifi", "sm"), " ", t("Which Wi-Fi networks count as home", "邊啲 Wi-Fi 當係屋企")),
        h("p", { class: "t2" }, t("A device on one of these networks is counted as home. Guest networks are left out unless you include them.", "連住呢啲網絡嘅裝置會當係喺屋企。訪客網絡除非你揀咗，否則唔計。")),
        state.networks.length ? state.networks.map((n) => h("label", { class: "row" }, h("input", { type: "checkbox", disabled: !o, checked: picked.has(n.ifname), onChange: (e) => { e.target.checked ? picked.add(n.ifname) : picked.delete(n.ifname); save({ picked: [...picked] }); } }), h("span", { class: "grow" }, `${n.ssid || n.ifname}`, n.guest ? ` · ${t("guest", "訪客")}` : "", ` · ${n.band ?? ""}`), h("span", { class: "muted" }, n.clients === null ? t("cannot read", "讀唔到") : t(`${n.clients} connected`, `${n.clients} 部連住`)))) : h("div", { class: "muted" }, t("No Wi-Fi networks found.", "搵唔到 Wi-Fi 網絡。"))),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("schedule", "sm"), " ", t("Time zone", "時區")),
        h("p", { class: "t2" }, t("The schedule runs on this time. If the server is in another time zone, set it to yours.", "時間表按呢個時間運行。如果伺服器喺另一個時區，請設定做你嘅時區。")),
        h("button", { class: "btn t", disabled: !o, onClick: async () => { try { await put("/api/household", { tzOffsetMinutes: -new Date().getTimezoneOffset() }); toast(t("Time zone saved.", "已儲存時區。")); reloadAll(); } catch (error) { toast(errText(error), "bad"); } } }, icon("public", "sm"), t("Use this browser's time zone", "用呢個瀏覽器嘅時區")),
        h("div", { class: "t2" }, state.data.tzOffsetMinutes === null || state.data.tzOffsetMinutes === undefined ? t("Using the server's own time.", "而家用伺服器自己嘅時間。") : t(`Offset saved: ${state.data.tzOffsetMinutes} minutes from UTC.`, `已儲存偏移：UTC ${state.data.tzOffsetMinutes} 分鐘。`))),
    ];
  }

  async function talkersView() {
    const host = h("div", {});
    stopTalkers?.();
    stopTalkers = await talkersPanel(host, { members: state.data.members });
    return host;
  }

  async function drawBody() {
    stopTalkers?.();
    stopTalkers = null;
    clear(tabs).append(...TABS.map(([id, ic, en, yue]) => h("button", { role: "tab", "aria-selected": String(state.tab === id), class: state.tab === id ? "on" : "", onClick: () => { state.tab = id; drawBody(); } }, icon(ic, "sm"), t(en, yue))));
    clear(body);
    const view = { people: peopleView, presence: presenceView, homeassistant: haView, networks: networksView, talkers: talkersView }[state.tab];
    const out = await view();
    body.append(...[out].flat(Infinity).filter(Boolean));
  }
  async function reloadAll() {
    try { await load(); } catch (error) { toast(errText(error), "bad"); }
    await drawBody();
    refreshAllowance();
  }

  page.append(h("div", { class: "rise" }, h("h1", { class: "disp" }, tt(label)), h("p", { class: "lede" }, t("Who lives here, when they are at work, asleep or home, and how much disturbance they will put up with. The router only looks at which home Wi-Fi a device is on.", "屋企有邊個、佢幾時返工、瞓覺或者喺屋企，以及佢可以接受幾多滋擾。路由器只睇裝置連住邊個屋企 Wi-Fi。"))), tabs, body);
  await loadSafety();
  await reloadAll();
  timer = setInterval(() => { if (state.tab === "presence") load().then(drawBody).catch(() => {}); }, 15000);
  const off = bus.on("lang", () => {});
  return () => { clearInterval(timer); stopTalkers?.(); off(); };
}

export default {
  id: "household",
  screens: [
    { id: "household", group: { en: "Safety", yue: "安全" }, icon: "family_restroom", label, render: (ctx) => render(ctx, "people") },
    { id: "top-talkers", group: { en: "Monitor", yue: "監察" }, icon: "swap_vert", label: talkersLabel, async render(ctx) {
      const page = h("div", { class: "page" }, h("div", { class: "rise" }, h("h1", { class: "disp" }, tt(talkersLabel))));
      ctx.root.append(page);
      const members = (await api.get("/api/household").catch(() => ({ members: [] }))).members;
      return talkersPanel(page, { members });
    } },
  ],
  settings: [{ id: "household", icon: "family_restroom", label, async render(ctx) {
    const data = await api.get("/api/household");
    return madnessCard(data, safety.owner, () => refreshAllowance());
  } }],
  commands: [
    { id: "household.open", icon: "family_restroom", label: { en: "Open the household", yue: "打開屋企設定" }, keywords: "household brother madness allowance 屋企 兄弟", run: (ctx) => ctx.navigate("household") },
    { id: "household.talkers", icon: "swap_vert", label: { en: "Who is uploading or downloading the most", yue: "邊個上傳或下載最多" }, keywords: "top talkers upload download bandwidth busiest 上傳 下載 流量", run: (ctx) => ctx.navigate("top-talkers") },
  ],
};
