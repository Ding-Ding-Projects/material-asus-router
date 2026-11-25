// LAN Pro: the home network in full. The router's own address and mask come
// from the stock settings, drawn here beside this feature's own: what devices
// are told (gateway, name servers), reserved addresses with a device picker,
// and the switch. The automatic address range is a range bar over the home
// network and the lease time is a slider; both write the stock settings
// through the pending-changes dock, so every edit gets a preview and undo.
import { buildScreen, nowValue } from "./view.js";
import { tableEditor } from "./table.js";

const F = "lan-pro";
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const num = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
const LEASES = [120, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 86400, 172800, 259200, 604800];
const PRESETS = [[3600, "1 hour", "1 個鐘"], [43200, "12 hours", "12 個鐘"], [86400, "1 day", "1 日"], [604800, "1 week", "1 星期"]];
const HIDDEN = new Set(["dhcp.start", "dhcp.end", "dhcp.lease"]);

export default {
  id: F,
  controls: { lanreservations: tableEditor },

  screens: [{
    id: F,
    group: { en: "Network", yue: "網絡" },
    icon: "lan",
    label: { en: "Local network Pro", yue: "本地網絡進階" },
    render: (ctx) => buildScreen(ctx, {
      id: F,
      title: { en: "Local network Pro", yue: "本地網絡進階" },
      lede: { en: "The router's address, the range of automatic addresses, what devices are told, and addresses reserved for chosen devices.", yue: "路由器地址、自動派地址嘅範圍、裝置收到嘅資料，同埋留俾指定裝置嘅地址。" },
      entries: (data) => [...data.stock.filter((e) => !HIDDEN.has(e.id)), ...data.entries],
      before: (data, ctx2, view) => [summary(ctx2, data), pool(ctx2, data)],
      after: (data, ctx2, view) => clients(ctx2, data, view),
    }),
  }],
};

const human = (ctx, seconds) => {
  const { t } = ctx;
  if (seconds % 86400 === 0) return t(`${seconds / 86400} day${seconds === 86400 ? "" : "s"}`, `${seconds / 86400} 日`);
  if (seconds % 3600 === 0) return t(`${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`, `${seconds / 3600} 個鐘`);
  if (seconds % 60 === 0) return t(`${seconds / 60} minutes`, `${seconds / 60} 分鐘`);
  return t(`${seconds} seconds`, `${seconds} 秒`);
};

// The home network as the person has it now, pending edits included.
function network(ctx, data) {
  const get = (id) => nowValue(ctx, data.stock.find((e) => e.id === id));
  const ip = get("lan.ip");
  const mask = get("lan.mask");
  if (!IPV4.test(ip) || !IPV4.test(mask)) return null;
  const m = num(mask) >>> 0;
  const start = (num(ip) & m) >>> 0;
  return { ip, start, size: (~m >>> 0) + 1, prefix: m.toString(2).replace(/0/g, "").length };
}

function summary(ctx, data) {
  const { h, icon, t } = ctx;
  const net = data.lan;
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("lan", "sm"), " ", t("Your home network", "你嘅屋企網絡")),
    net ? h("div", { class: "chips factrow" },
      h("span", { class: "tag" }, `${t("Network", "網絡")}: `, h("b", {}, `${net.network}/${net.prefix}`)),
      h("span", { class: "tag" }, `${t("Router", "路由器")}: `, h("b", {}, net.ip)),
      h("span", { class: "tag" }, `${t("Room for", "最多")}: `, h("b", {}, `${net.hosts.toLocaleString()} ${t("devices", "部裝置")}`)),
      h("span", { class: "tag" }, `${t("Reserved", "已留住")}: `, h("b", {}, String(data.reservations)))) : h("div", { class: "note" }, icon("info"), t("The router's address is not set.", "未有設定路由器地址。")));
}

// The automatic address range drawn over the home network, and the lease time as a slider.
function pool(ctx, data) {
  const { h, icon, t } = ctx;
  const entry = (id) => data.stock.find((e) => e.id === id);
  const [startE, endE, leaseE] = [entry("dhcp.start"), entry("dhcp.end"), entry("dhcp.lease")];
  if (!startE || !endE || !leaseE) return null;
  const locked = !ctx.state.canWrite;
  const bar = h("div", { class: "rangebar", role: "img", "aria-label": t("Where the automatic addresses sit in your home network", "自動派嘅地址喺屋企網絡入面嘅位置") }, h("i"));
  const out = h("div", { class: "t2", role: "status", "aria-live": "polite" });
  const field = (e, label) => h("input", {
    class: "field mono", value: nowValue(ctx, e), disabled: locked, autocomplete: "off", spellcheck: "false", inputmode: "decimal", maxlength: "15", "aria-label": label,
    onInput(ev) { ctx.dock.setEntry(e, ev.target.value.trim()); draw(); },
  });
  const first = field(startE, t("First automatic address", "第一個自動地址"));
  const last = field(endE, t("Last automatic address", "最後一個自動地址"));
  const slider = h("input", {
    type: "range", min: "0", max: String(LEASES.length - 1), step: "1", disabled: locked, "aria-label": t("Lease time", "租用時間"),
    onInput(ev) { ctx.dock.setEntry(leaseE, String(LEASES[Number(ev.target.value)])); draw(); },
  });
  const lease = h("output", {});
  const chips = PRESETS.map(([seconds, en, yue]) => h("button", { class: "chip", type: "button", disabled: locked, onClick() { ctx.dock.setEntry(leaseE, String(seconds)); draw(); } }, t(en, yue)));
  function draw() {
    const a = nowValue(ctx, startE);
    const b = nowValue(ctx, endE);
    const net = network(ctx, data);
    const ok = IPV4.test(a) && IPV4.test(b) && num(a) <= num(b);
    const mark = bar.firstChild.style;
    first.setAttribute("aria-invalid", String(!IPV4.test(a)));
    last.setAttribute("aria-invalid", String(!IPV4.test(b)));
    if (ok && net) {
      const from = Math.min(Math.max((num(a) - net.start) / net.size, 0), 1);
      const to = Math.min(Math.max((num(b) - net.start + 1) / net.size, 0), 1);
      mark.setProperty("--l", `${(from * 100).toFixed(1)}%`);
      mark.setProperty("--w", `${Math.max((to - from) * 100, 1).toFixed(1)}%`);
      const outside = num(a) < net.start || num(b) >= net.start + net.size;
      const holdsRouter = num(a) <= num(net.ip) && num(net.ip) <= num(b);
      out.textContent = outside ? t("Part of this range is outside your home network. Devices would get addresses the router cannot reach.", "呢個範圍有部分喺屋企網絡之外。裝置會攞到路由器連唔到嘅地址。")
        : holdsRouter ? t("The router's own address is inside this range. Move the range so it does not include it.", "路由器自己嘅地址喺呢個範圍入面。請移開個範圍。")
        : `${(num(b) - num(a) + 1).toLocaleString()} ${t("addresses for devices", "個地址俾裝置用")}`;
    } else {
      mark.setProperty("--w", "0%");
      out.textContent = IPV4.test(a) && IPV4.test(b) ? t("The first address must come before the last.", "第一個地址要喺最後一個之前。") : t("Enter two full addresses.", "請輸入兩個完整地址。");
    }
    const seconds = Number(nowValue(ctx, leaseE));
    const at = LEASES.reduce((best, v, i) => (Math.abs(v - seconds) < Math.abs(LEASES[best] - seconds) ? i : best), 0);
    slider.value = String(at);
    lease.textContent = Number.isFinite(seconds) ? human(ctx, seconds) : "—";
    chips.forEach((chip, i) => chip.classList.toggle("on", PRESETS[i][0] === seconds));
  }
  draw();
  return {
    stop: ctx.bus.on("dock", draw),
    nodes: h("section", { class: "card rise" },
      h("h2", { class: "h2" }, icon("dynamic_form", "sm"), " ", t("Automatic addresses", "自動派地址")),
      h("div", { class: "t2" }, t("Devices that join get an address from this range, for as long as the lease time.", "加入網絡嘅裝置會由呢個範圍攞地址，租用時間內有效。")),
      h("div", { class: "two" }, h("label", { class: "lbl" }, t("First address", "第一個地址"), first), h("label", { class: "lbl" }, t("Last address", "最後一個地址"), last)),
      bar, out,
      h("div", { class: "lbl" }, t("Lease time", "租用時間")),
      h("div", { class: "slider" }, slider, lease),
      h("div", { class: "chips" }, chips)),
  };
}

// Devices the router has seen, so a person can keep the address a device has now.
async function clients(ctx, data, view) {
  const { h, icon, t } = ctx;
  const entry = data.entries.find((e) => e.id === `${F}.reservations`);
  let list = [];
  try {
    list = (await ctx.api.get(`/api/x/${F}/clients`)).clients;
  } catch {
    return null;
  }
  const holder = h("div", {});
  const keep = (client) => {
    const rows = nowValue(ctx, entry);
    if (rows.toUpperCase().includes(`<${client.mac}>`)) return ctx.toast(t("That device already has a reserved address.", "嗰部裝置已經有留住嘅地址。"), "warn");
    const host = (client.host || "").replace(/[^A-Za-z0-9.-]/g, "-").slice(0, 32);
    ctx.dock.setEntry(entry, `${rows}<${client.mac}>${client.ip}>>${host}`);
    view.redraw();
    ctx.toast(t("Added to your changes.", "已加入改動。"), "good");
  };
  const draw = () => {
    const free = list.filter((c) => !c.reservedAddress);
    holder.replaceChildren(...(free.length ? free.map((c) => h("div", { class: "row" },
      icon("devices", "sm"),
      h("div", { class: "grow" }, h("div", { class: "t1" }, c.host || c.mac), h("div", { class: "t2 mono" }, `${c.ip} · ${c.mac}`)),
      ctx.state.canWrite ? h("button", { class: "btn t sm", type: "button", "aria-label": `${t("Keep this address for", "留住呢個地址俾")} ${c.host || c.mac}`, onClick: () => keep(c) }, icon("push_pin", "sm"), t("Keep this address", "留住呢個地址")) : null))
      : [h("div", { class: "t2" }, t("Every known device already has a reserved address.", "所有已知裝置都已經留住咗地址。"))]));
  };
  draw();
  return h("section", { class: "card rise" },
    h("h2", { class: "h2" }, icon("devices", "sm"), " ", t("Keep an address a device has now", "留住裝置而家嘅地址")),
    h("div", { class: "t2" }, t("The device will keep getting this same address. The change waits in your pending changes until you apply it.", "裝置之後每次都會攞同一個地址。改動會先放喺待處理改動，等你確認先套用。")),
    holder);
}
