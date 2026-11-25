// Internet Pro: the whole WAN connection. The settings come from the server as
// typed controls (connection type, the fields each type needs, MTU and MRU,
// MAC clone, provider requirements, VLAN and IPTV). This screen adds the live
// connection status, a reconnect button, an MTU finder and a plain-words hint
// for the chosen VLAN profile. Fields that do not apply to the chosen
// connection type are hidden, and every edit waits in the pending-changes dock.
import { buildScreen, facts, nowValue } from "./view.js";

const F = "internet-pro";
const STATE = { good: { en: "Connected", yue: "已連線" }, bad: { en: "Not connected", yue: "未連線" } };
const TYPE = { dhcp: ["Automatic (DHCP)", "自動（DHCP）"], static: ["Fixed IP", "固定 IP"], pppoe: ["PPPoE", "PPPoE"], pptp: ["PPTP", "PPTP"], l2tp: ["L2TP", "L2TP"] };

export default {
  id: F,

  screens: [{
    id: F,
    group: { en: "Network", yue: "網絡" },
    icon: "public",
    label: { en: "Internet Pro", yue: "互聯網進階" },
    render: (ctx) => buildScreen(ctx, {
      id: F,
      title: { en: "Internet Pro", yue: "互聯網進階" },
      lede: { en: "How the router reaches the internet: connection type, the fields it needs, packet size, what your provider asks for, and VLAN tagging for IPTV.", yue: "路由器點樣連上互聯網：連線類型、需要嘅欄位、封包大小、供應商嘅要求，同 IPTV 嘅 VLAN 標籤。" },
      before: (data, ctx2, view) => [status(ctx2, data), mtuFinder(ctx2, data, view), profileHint(ctx2, data)],
    }),
  }],

  commands: [{
    id: `${F}.reconnect`,
    icon: "refresh",
    label: { en: "Internet Pro: reconnect to the internet", yue: "互聯網進階：重新連線上網" },
    keywords: ["wan", "reconnect", "restart", "internet", "重新連線"],
    run: (ctx) => reconnect(ctx),
  }],
};

async function reconnect(ctx) {
  const ok = await ctx.confirmDialog({
    title: ctx.t("Reconnect to the internet?", "重新連線上網？"),
    body: ctx.t("The connection drops for a few seconds while the router asks for a fresh address.", "路由器會重新攞地址，連線會斷幾秒。"),
    confirm: ctx.t("Reconnect", "重新連線"),
  });
  if (!ok) return;
  try {
    const result = await ctx.api.post(`/api/actions/${F}.reconnect`);
    ctx.toast(result.message, result.ok ? "good" : "bad");
  } catch (error) {
    ctx.toast(error.message, "bad");
  }
}

function status(ctx, data) {
  const { h, icon, t, tt } = ctx;
  const wan = data.wan;
  const type = TYPE[wan.proto] ?? [wan.proto || "—", wan.proto || "—"];
  return h("section", { class: "card tone rise" },
    h("div", { class: "row" },
      h("h2", { class: "h2 grow" }, icon(wan.connected ? "check_circle" : "error", "sm"), " ", tt(wan.connected ? STATE.good : STATE.bad)),
      ctx.state.canWrite ? h("button", { class: "btn t sm", onClick: () => reconnect(ctx) }, icon("refresh", "sm"), t("Reconnect", "重新連線")) : null),
    facts(ctx, [
      { label: { en: "Type", yue: "類型" }, value: t(type[0], type[1]) },
      { label: { en: "Address", yue: "地址" }, value: wan.ip || "—" },
      { label: { en: "Gateway", yue: "網關" }, value: wan.gateway || "—" },
      { label: { en: "Name servers", yue: "域名伺服器" }, value: wan.dns.join(", ") || "—" },
    ]));
}

// Asks the router for the largest packet that gets through, then offers to use it.
function mtuFinder(ctx, data, view) {
  const { h, icon, t } = ctx;
  const target = h("input", { class: "field mono", value: "", placeholder: "203.0.113.9", autocomplete: "off", spellcheck: "false", "aria-label": t("Host to test against", "測試對象主機") });
  const out = h("div", { class: "t2", role: "status", "aria-live": "polite" });
  const find = h("button", { class: "btn t sm", type: "button", onClick: async () => {
    find.disabled = true;
    out.textContent = t("Testing packet sizes…", "測試緊封包大小…");
    try {
      const res = await ctx.api.post(`/api/x/${F}/mtu-probe`, { target: target.value.trim() || undefined });
      out.replaceChildren();
      if (!res.mtu) return void (out.textContent = t("Nothing got through. Try another host.", "冇封包通過。試下另一個主機。"));
      const entry = data.entries.find((e) => e.id === `${F}.mtu`);
      out.append(`${t("The best MTU is", "最佳 MTU 係")} ${res.mtu}. `,
        ctx.state.canWrite && entry ? h("button", { class: "btn f sm", type: "button", onClick() { ctx.dock.setEntry(entry, String(res.mtu)); view.redraw(); out.textContent = t("Added to your changes.", "已加入改動。"); } }, t("Use it", "用佢")) : null);
    } catch (error) {
      out.textContent = error.message;
    } finally {
      find.disabled = false;
    }
  } }, icon("straighten", "sm"), t("Find the best MTU", "搵最佳 MTU"));
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("straighten", "sm"), " ", t("Packet size finder", "封包大小搜尋")),
    h("div", { class: "t2" }, t("Tries bigger packets first and stops at the largest one that is not split up on the way.", "由大封包試起，停喺未被拆開嘅最大封包。")),
    h("div", { class: "row" }, h("div", { class: "grow" }, target), find),
    out);
}

// Says in plain words what the chosen VLAN profile normally uses.
function profileHint(ctx, data) {
  const { h, t } = ctx;
  const entry = data.entries.find((e) => e.id === `${F}.profile`);
  const line = h("div", { class: "note", role: "status", "aria-live": "polite" });
  const draw = () => {
    const name = entry ? nowValue(ctx, entry) : "none";
    const known = data.profiles[name];
    if (name === "none" || !entry) line.textContent = t("No VLAN profile. The internet and your IPTV box use ordinary, untagged traffic.", "冇 VLAN 設定檔。上網同 IPTV 機頂盒用普通、冇標籤嘅流量。");
    else if (name === "manual") line.textContent = t("Manual. Type the VLAN ids your provider gave you below.", "手動。喺下面輸入供應商俾你嘅 VLAN 編號。");
    else if (known) line.textContent = [t("Typical values for this profile:", "呢個設定檔通常用："), `${t("internet", "上網")} ${known.internet}`, known.iptv ? `IPTV ${known.iptv}` : null, known.voip ? `${t("phone", "電話")} ${known.voip}` : null].filter(Boolean).join(" · ") + ". " + t("Your provider decides, so check with them.", "最終由供應商決定，請向佢哋確認。");
    else line.textContent = t("The router fills in this provider's VLAN ids itself. Ask your provider if unsure.", "路由器會自動填入呢個供應商嘅 VLAN 編號。唔肯定請問供應商。");
  };
  draw();
  return { nodes: line, stop: ctx.bus.on("dock", draw) };
}
