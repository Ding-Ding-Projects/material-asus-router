// IPv6: native, passthrough, 6in4, 6rd and static, with the prefix, name
// servers and DHCPv6 settings. The settings come from the server as typed
// controls, including two this feature adds: an IPv6 address box that checks
// itself as you type, and a hexadecimal pool-address box. This screen adds the
// live status, a plain sentence about the chosen connection type and an
// address checker. Fields that do not apply are hidden, and every edit waits
// in the pending-changes dock.
import { buildScreen, facts, nowValue } from "./view.js";

const F = "ipv6";

// The same reading of IPv6 text as the server, so the box can answer while you type.
function parse(text) {
  if (!/^[0-9A-Fa-f:]{2,39}$/.test(text)) return null;
  const parts = text.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const groups = [...head, ...tail];
  if (groups.some((g) => !/^[0-9A-Fa-f]{1,4}$/.test(g))) return null;
  if (parts.length === 1 ? groups.length !== 8 : groups.length > 7) return null;
  return [...head, ...(parts.length === 2 ? new Array(8 - groups.length).fill("0") : []), ...tail].map((g) => parseInt(g, 16));
}

function compress(words) {
  let best = { start: -1, length: 0 };
  for (let i = 0; i < 8; ) {
    if (words[i] !== 0) { i += 1; continue; }
    let j = i;
    while (j < 8 && words[j] === 0) j += 1;
    if (j - i > best.length) best = { start: i, length: j - i };
    i = j;
  }
  const hex = words.map((w) => w.toString(16));
  return best.length < 2 ? hex.join(":") : `${hex.slice(0, best.start).join(":")}::${hex.slice(best.start + best.length).join(":")}`;
}

const KIND = { global: ["Global address", "全球地址"], documentation: ["Example address (documentation range)", "示範地址（文件用範圍）"], "link-local": ["Link-local address", "鏈路本地地址"], "unique-local": ["Private address (unique local)", "私人地址（唯一本地）"], loopback: ["Loopback", "迴環"], multicast: ["Multicast", "多播"], unspecified: ["Unspecified", "未指定"] };

const SENTENCE = {
  disabled: ["IPv6 is off. Devices use IPv4 only.", "IPv6 關閉。裝置只用 IPv4。"],
  dhcp6: ["The provider gives the router an address and a prefix for your home. Every device then gets its own IPv6 address.", "供應商俾路由器一個地址同一段屋企用嘅前綴。之後每部裝置都有自己嘅 IPv6 地址。"],
  static6: ["You type the address, prefix and gateway your provider gave you.", "你自己輸入供應商俾你嘅地址、前綴同網關。"],
  ipv6pt: ["The router passes IPv6 straight through to a device behind it. That device does the routing and the protection.", "路由器將 IPv6 直接轉俾後面一部裝置處理。嗰部裝置負責路由同防護。"],
  "6in4": ["IPv6 travels inside IPv4 to your tunnel provider, who gives you a prefix.", "IPv6 包喺 IPv4 入面送去隧道供應商，供應商再分一段前綴俾你。"],
  "6rd": ["Your provider carries IPv6 over its IPv4 network and builds your prefix from your IPv4 address.", "供應商經佢嘅 IPv4 網絡傳送 IPv6，並按你嘅 IPv4 地址砌出前綴。"],
  "6to4": ["The router builds a tunnel through a public relay and derives a prefix from its IPv4 address.", "路由器經公共中繼建立隧道，按自己嘅 IPv4 地址推出前綴。"],
  flets: ["The special setup NTT's FLET'S network in Japan uses.", "日本 NTT FLET'S 網絡用嘅特別設定。"],
};

export default {
  id: F,

  // The address box and the pool box this feature adds to the controls library.
  controls: {
    ipv6addr(entry, current, commit, locked, ctx) {
      const { h, t, tt } = ctx;
      const note = h("div", { class: "t2", role: "status", "aria-live": "polite" });
      const draw = (value) => {
        const words = value === "" ? null : parse(value);
        input.setAttribute("aria-invalid", String(value !== "" && !words));
        note.textContent = value === "" ? "" : words ? `${compress(words)}  ·  ${t(...KIND[kindOf(words)])}` : t("This is not a valid IPv6 address.", "呢個唔係有效嘅 IPv6 地址。");
      };
      const input = h("input", {
        class: "field mono", value: current(), disabled: locked, autocomplete: "off", spellcheck: "false", maxlength: "39", "aria-label": tt(entry.label),
        placeholder: entry.optional ? t("Optional", "可選") : "2001:db8::1",
        onInput(e) { const value = e.target.value.trim(); draw(value); commit(value); },
      });
      draw(current());
      return { el: h("div", { class: "ipv6box" }, input, note), sync() { input.value = current(); draw(current()); } };
    },
    hexpart(entry, current, commit, locked, ctx) {
      const { h, t, tt } = ctx;
      const input = h("input", {
        class: "field mono", value: current(), disabled: locked, autocomplete: "off", spellcheck: "false", maxlength: "4", inputmode: "text", "aria-label": tt(entry.label),
        onInput(e) { const value = e.target.value.trim(); input.setAttribute("aria-invalid", String(!/^[0-9A-Fa-f]{1,4}$/.test(value))); commit(value); },
      });
      return { el: h("div", { class: "ipv6box" }, h("div", { class: "ctl" }, h("span", { class: "t2 mono" }, "…::"), input), h("div", { class: "t2" }, t("One to four hexadecimal digits.", "一至四個十六進制數字。"))), sync() { input.value = current(); } };
    },
  },

  screens: [{
    id: F,
    group: { en: "Network", yue: "網絡" },
    icon: "language",
    label: { en: "IPv6", yue: "IPv6" },
    render: (ctx) => buildScreen(ctx, {
      id: F,
      title: { en: "IPv6", yue: "IPv6" },
      lede: { en: "The newer internet addressing. Choose how your provider delivers it, then how devices at home get their addresses.", yue: "新一代上網地址。揀供應商點樣提供，再揀屋企裝置點樣攞地址。" },
      before: (data, ctx2) => [status(ctx2, data), explain(ctx2, data), checker(ctx2)],
    }),
  }],
};

const kindOf = (words) => {
  if (words.every((w) => w === 0)) return "unspecified";
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return "loopback";
  if (words[0] === 0x2001 && words[1] === 0x0db8) return "documentation";
  if ((words[0] & 0xffc0) === 0xfe80) return "link-local";
  if ((words[0] & 0xfe00) === 0xfc00) return "unique-local";
  if ((words[0] & 0xff00) === 0xff00) return "multicast";
  return "global";
};

function status(ctx, data) {
  const { h, icon, t } = ctx;
  const on = data.service !== "disabled";
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("language", "sm"), " ", on ? t("IPv6 is on", "IPv6 已開啟") : t("IPv6 is off", "IPv6 未開啟")),
    facts(ctx, [
      { label: { en: "Router address", yue: "路由器地址" }, value: data.runtime.wanAddress || "—" },
      { label: { en: "Home prefix", yue: "屋企前綴" }, value: data.runtime.lanPrefix || "—" },
      { label: { en: "IPv6 firewall", yue: "IPv6 防火牆" }, value: data.firewall ? t("on", "開") : t("off", "關"), tone: data.firewall ? "good" : "warn" },
    ]),
    on && !data.firewall ? h("div", { class: "note" }, icon("warning"), t("The IPv6 firewall is off, so devices with an IPv6 address can be reached from the internet. Turn it on under Firewall unless you are sure.", "IPv6 防火牆關咗，有 IPv6 地址嘅裝置可以從互聯網直接連到。除非你肯定，否則請喺「防火牆」開返。")) : null);
}

function explain(ctx, data) {
  const { h, t } = ctx;
  const entry = data.entries.find((e) => e.id === `${F}.service`);
  const line = h("div", { class: "note", role: "status", "aria-live": "polite" });
  const draw = () => {
    const sentence = SENTENCE[nowValue(ctx, entry)];
    line.textContent = sentence ? t(sentence[0], sentence[1]) : "";
  };
  draw();
  return { nodes: line, stop: ctx.bus.on("dock", draw) };
}

// Asks the server what an address means, so a person can paste one and see it spelled out.
function checker(ctx) {
  const { h, icon, t } = ctx;
  const input = h("input", { class: "field mono", autocomplete: "off", spellcheck: "false", maxlength: "39", placeholder: "2001:db8::1", "aria-label": t("An IPv6 address to check", "要檢查嘅 IPv6 地址") });
  const out = h("div", { class: "t2 mono ipv6out", role: "status", "aria-live": "polite" });
  const check = async () => {
    try {
      const res = await ctx.api.post(`/api/x/${F}/check-address`, { address: input.value.trim() });
      out.textContent = res.valid ? `${res.compressed}\n${res.expanded}\n${t(...KIND[res.kind])}` : t("This is not a valid IPv6 address.", "呢個唔係有效嘅 IPv6 地址。");
    } catch (error) {
      out.textContent = error.message;
    }
  };
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("spellcheck", "sm"), " ", t("Check an address", "檢查地址")),
    h("div", { class: "row" }, h("div", { class: "grow" }, input), h("button", { class: "btn t sm", type: "button", onClick: check }, t("Check", "檢查"))),
    out);
}
