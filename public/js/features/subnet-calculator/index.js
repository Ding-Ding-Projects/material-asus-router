// Subnet calculator: a tool that runs entirely in the browser. Type an address
// and a prefix (or a mask) and see the network, its range, how many devices fit
// and which bits belong to the network; split it into smaller networks and test
// whether an address is inside. It never touches the router.
import { COMMON, contains, describeNetwork, binary, isIpv4, parseCidr, prefixOfMask, split, maskOf, toIp } from "./calc.js";

const label = { en: "Subnet calculator", yue: "子網計算機" };
const SCOPE = {
  private: ["Private (home and office networks)", "私人（屋企同辦公室網絡）"], shared: ["Shared carrier space (100.64.0.0/10)", "營辦商共用地址（100.64.0.0/10）"], loopback: ["Loopback", "迴環"],
  "link-local": ["Link-local (self-assigned)", "鏈路本地（自動分配）"], documentation: ["Documentation example addresses", "文件示範地址"], multicast: ["Multicast", "多播"], reserved: ["Reserved", "保留"],
  "this-network": ["This network", "本網絡"], public: ["Public internet", "公共互聯網"],
};
const KEY = "mar.subnet-calculator";

const remembered = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
const remember = (value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
};

async function screen(ctx) {
  const { h, icon, t } = ctx;
  const lan = ctx.state.catalog?.info?.lan;
  const lanPrefix = lan ? prefixOfMask(lan.mask) : null;
  const saved = remembered();
  const state = { ip: saved?.ip && isIpv4(saved.ip) ? saved.ip : lan?.ip ?? "198.51.100.0", prefix: Number.isInteger(saved?.prefix) ? saved.prefix : lanPrefix ?? 24, parts: 4, test: "", all: false };
  const page = ctx.page(label, { en: "Work out the range, size and mask of any IPv4 network, split it and test an address.", yue: "計算任何 IPv4 網絡嘅範圍、大細同遮罩，仲可以切開同測試地址。" });
  ctx.root.append(page);
  const out = h("div", {});

  const ip = h("input", { class: "field", inputmode: "decimal", autocomplete: "off", spellcheck: "false", "aria-label": t("IPv4 address, or address/prefix", "IPv4 地址，或者 地址/前綴"), value: state.ip,
    onInput: (e) => {
      const parsed = parseCidr(e.target.value);
      if (parsed) {
        state.ip = parsed.ip;
        if (parsed.prefix !== null && parsed.prefix <= 32) { state.prefix = parsed.prefix; syncPrefix(); }
      }
      paint();
    } });
  const slider = h("input", { type: "range", min: "0", max: "32", step: "1", value: String(state.prefix), "aria-label": t("Prefix length", "前綴長度"), onInput: (e) => { state.prefix = Number(e.target.value); syncPrefix(); paint(); } });
  const number = h("input", { class: "field num", type: "number", min: "0", max: "32", inputmode: "numeric", value: String(state.prefix), "aria-label": t("Prefix length number", "前綴長度數字"), onInput: (e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 32) { state.prefix = n; syncPrefix(true); paint(); } } });
  const mask = h("select", { class: "field", "aria-label": t("Subnet mask", "子網遮罩"), onChange: (e) => { state.prefix = Number(e.target.value); syncPrefix(); paint(); } },
    Array.from({ length: 33 }, (_, p) => h("option", { value: String(p) }, `${toIp(maskOf(p))}  /${p}`)));
  function syncPrefix(skipNumber) {
    slider.value = String(state.prefix);
    if (!skipNumber) number.value = String(state.prefix);
    mask.value = String(state.prefix);
  }

  const row = (name, value, note) => h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t2" }, name), h("div", { class: "t1 mono sc-val" }, value), note ? h("div", { class: "t2" }, note) : null),
    h("button", { class: "btn t icon", title: t("Copy", "複製"), "aria-label": `${t("Copy", "複製")} ${name}`, onClick: async () => { try { await navigator.clipboard.writeText(String(value)); ctx.toast(t("Copied.", "已複製。")); } catch { ctx.toast(t("Copying is not allowed here.", "呢度唔俾複製。"), "warn"); } } }, icon("content_copy", "sm")));

  // The 32 bits, grouped by octet: network bits solid, host bits outlined.
  const bits = (net) => h("div", { class: "sc-bits", role: "img", "aria-label": t(`${net.prefix} network bits and ${32 - net.prefix} host bits`, `${net.prefix} 個網絡位元同 ${32 - net.prefix} 個主機位元`) },
    [0, 1, 2, 3].map((o) => h("div", { class: "sc-octet" }, h("div", { class: "sc-cells" }, Array.from({ length: 8 }, (_, i) => h("span", { class: o * 8 + i < net.prefix ? "sc-net" : "sc-host" }))), h("div", { class: "t2 mono" }, String(Number(net.ip.split(".")[o]))))));

  function paint() {
    ctx.clear(out);
    let net;
    try {
      net = describeNetwork(state.ip, state.prefix);
    } catch (error) {
      return void out.append(h("div", { class: "note warn", role: "status" }, icon("info"), h("div", {}, error.message)));
    }
    remember({ ip: state.ip, prefix: state.prefix });
    const [scopeEn, scopeYue] = SCOPE[net.scope];
    let parts = null;
    let splitError = "";
    try { parts = split(net, state.parts); } catch (error) { splitError = error.message; }
    out.append(
      h("div", { class: "grid2" },
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Network", "網絡")), h("div", { class: "big mono" }, net.cidr),
          h("div", { class: "t2" }, `${t(scopeEn, scopeYue)} · ${t("class", "類別")} ${net.klass}`),
          net.isNetworkAddress ? null : h("div", { class: "note" }, icon("info"), h("div", {}, t(`${net.ip} is inside this network; the network itself starts at ${net.networkIp}.`, `${net.ip} 喺呢個網絡入面；網絡由 ${net.networkIp} 開始。`))),
          bits(net),
          h("div", { class: "chips" }, h("span", { class: "tag" }, t(`${net.prefix} network bits`, `${net.prefix} 個網絡位元`)), h("span", { class: "tag" }, t(`${32 - net.prefix} host bits`, `${32 - net.prefix} 個主機位元`)))),
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Devices that fit", "可以放幾多部裝置")), h("div", { class: "big" }, net.usable.toLocaleString()),
          h("div", { class: "t2" }, net.prefix === 32 ? t("A single host address.", "單一主機地址。") : net.prefix === 31 ? t("A point-to-point link: both addresses are usable.", "點對點連線：兩個地址都用得。") : t(`${net.size.toLocaleString()} addresses, less the network and broadcast addresses.`, `${net.size.toLocaleString()} 個地址，減去網絡地址同廣播地址。`)))),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Details", "詳情")),
        row(t("Subnet mask", "子網遮罩"), net.maskIp), row(t("Wildcard mask", "反向遮罩"), net.wildcardIp), row(t("Network address", "網絡地址"), net.networkIp),
        row(t("First usable address", "第一個可用地址"), net.firstIp), row(t("Last usable address", "最後一個可用地址"), net.lastIp), row(t("Broadcast address", "廣播地址"), net.prefix >= 31 ? t("none for this size", "呢個大細冇") : net.broadcastIp),
        row(t("Address in binary", "二進制地址"), binary(net.address)), row(t("Mask in binary", "二進制遮罩"), binary(net.mask))),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Is an address inside?", "地址喺唔喺入面？")),
        h("input", { class: "field", inputmode: "decimal", spellcheck: "false", placeholder: "198.51.100.77", "aria-label": t("Address to test", "要測試嘅地址"), value: state.test, onInput: (e) => { state.test = e.target.value.trim(); paintTest(); } }),
        h("div", { class: "sc-test", role: "status", "aria-live": "polite" })),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Split into smaller networks", "切成較細嘅網絡")),
        h("div", { class: "seg", role: "radiogroup", "aria-label": t("Number of parts", "份數") }, [2, 4, 8, 16, 32, 64].map((n) => h("button", { role: "radio", "aria-checked": String(state.parts === n), class: state.parts === n ? "on" : "", onClick: () => { state.parts = n; paint(); } }, String(n)))),
        splitError ? h("div", { class: "note warn" }, icon("info"), h("div", {}, splitError))
          : h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, ["#", t("Network", "網絡"), t("Usable range", "可用範圍"), t("Devices", "裝置數")].map((x) => h("th", {}, x)))),
            h("tbody", {}, parts.slice(0, state.all ? 256 : 16).map((p, i) => h("tr", {}, h("td", {}, String(i + 1)), h("td", { class: "mono" }, p.cidr), h("td", { class: "mono" }, p.prefix >= 31 ? p.firstIp : `${p.firstIp} – ${p.lastIp}`), h("td", {}, p.usable.toLocaleString())))))),
        parts && parts.length > 16 && !state.all ? h("button", { class: "btn t sm", onClick: () => { state.all = true; paint(); } }, t(`Show all ${parts.length}`, `顯示全部 ${parts.length} 個`)) : null));
    paintTest();
    function paintTest() {
      const box = out.querySelector(".sc-test");
      if (!box) return;
      ctx.clear(box);
      if (!state.test) return void box.append(h("span", { class: "muted" }, t("Type an address to test.", "輸入要測試嘅地址。")));
      const ok = isIpv4(state.test) ? contains(net, state.test) : null;
      box.append(ok === null ? h("span", { class: "tag warn" }, icon("help", "sm"), t("Not a valid IPv4 address.", "唔係有效嘅 IPv4 地址。")) : ok ? h("span", { class: "tag good" }, icon("check_circle", "sm"), t(`${state.test} is inside ${net.cidr}.`, `${state.test} 喺 ${net.cidr} 入面。`)) : h("span", { class: "tag bad" }, icon("block", "sm"), t(`${state.test} is outside ${net.cidr}.`, `${state.test} 喺 ${net.cidr} 外面。`)));
    }
  }

  page.append(
    h("section", { class: "card rise" },
      h("label", { class: "t2" }, t("Address", "地址")), ip,
      h("label", { class: "t2" }, t("Prefix length", "前綴長度")), h("div", { class: "chips" }, slider, number),
      h("label", { class: "t2" }, t("Subnet mask", "子網遮罩")), mask,
      h("div", { class: "chips" }, ...COMMON.map((p) => h("button", { class: "chip", onClick: () => { state.prefix = p; syncPrefix(); paint(); } }, `/${p}`)),
        lan && lanPrefix !== null ? h("button", { class: "btn t sm", onClick: () => { state.ip = lan.ip; state.prefix = lanPrefix; ip.value = lan.ip; syncPrefix(); paint(); } }, icon("router", "sm"), t("My router's network", "我部路由器嘅網絡")) : null)),
    out);
  syncPrefix();
  paint();
}

export default {
  id: "subnet-calculator",
  screens: [{ id: "subnet-calculator", group: { en: "Network", yue: "網絡" }, icon: "calculate", label, render: screen }],
  commands: [{ id: "subnet-calculator.open", icon: "calculate", label: { en: "Open the subnet calculator", yue: "開啟子網計算機" }, keywords: "subnet cidr mask netmask ip range calculator split 子網 遮罩 計算", run: (ctx) => ctx.navigate("subnet-calculator") }],
};
