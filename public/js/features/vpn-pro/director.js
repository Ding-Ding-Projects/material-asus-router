// VPN Director (Merlin): choose, device by device, which connection carries
// the traffic. Also IPsec (shown, gated) and a read-only look at VPN Fusion.

const where = (iface) => (iface === "WAN" ? { en: "The internet directly (no VPN)", yue: "直接上網（唔經 VPN）" } : iface.startsWith("OVPN") ? { en: `OpenVPN client ${iface.slice(4)}`, yue: `OpenVPN 客戶端 ${iface.slice(4)}` } : { en: `WireGuard client ${iface.slice(3)}`, yue: `WireGuard 客戶端 ${iface.slice(3)}` });

// A rule through OpenVPN client N only works while that client follows policy rules.
export const policyProblem = (data, iface) => iface.startsWith("OVPN") && data.director.clientPolicy[iface] !== "2";

function rulesCard(ctx, ui, data, refresh) {
  const { api, h, t, tt, icon, confirmDialog } = ctx;
  const d = data.director;
  const edit = async (rule) => {
    const devices = await api.get("/api/domain/devices").then((r) => r.devices ?? []).catch(() => []);
    ui.form({
      title: rule ? t(`Edit ${rule.desc}`, `編輯 ${rule.desc}`) : t("Add a rule", "新增規則"),
      intro: t("Pick a device, or type an address or network, then choose which connection its traffic should use.", "揀一部裝置，或者輸入地址或網絡，然後揀佢嘅流量用邊個連線。"),
      fields: [
        { name: "desc", label: { en: "Name", yue: "名稱" }, value: rule?.desc ?? "", maxlength: 32 },
        { name: "pick", label: { en: "Device", yue: "裝置" }, type: "select", options: [["", { en: "Choose a device or type below", yue: "揀一部裝置，或者喺下面輸入" }], ...devices.filter((x) => x.ip).map((x) => [x.ip, { en: `${x.name} (${x.ip})`, yue: `${x.name}（${x.ip}）` }])], value: devices.some((x) => x.ip === rule?.local) ? rule.local : "" },
        { name: "local", label: { en: "Or an address or network", yue: "或者輸入地址或網絡" }, value: devices.some((x) => x.ip === rule?.local) ? "" : rule?.local ?? "", placeholder: "198.51.100.0/24", maxlength: 18 },
        { name: "remote", label: { en: "Only for this destination (optional)", yue: "只限呢個目的地（可選）" }, value: rule?.remote ?? "", maxlength: 18, hint: { en: "Leave empty for every destination", yue: "留空就代表所有目的地" } },
        { name: "iface", label: { en: "Send through", yue: "經呢個連線" }, type: "select", options: d.interfaces.map((i) => [i, where(i)]), value: rule?.iface ?? "OVPN1" },
      ],
      submitLabel: t("Preview", "預覽"),
      async submit(v) {
        const preview = await api.post("/api/x/vpn-pro/director/rules", { index: rule?.index, enabled: rule?.enabled ?? true, desc: v.desc, local: v.pick || v.local, remote: v.remote, iface: v.iface });
        setTimeout(async () => ((await ui.review(preview, { title: t("VPN Director rule", "VPN Director 規則") }).closed) && refresh()), 0);
      },
    });
  };
  const toggle = async (rule) => ((await ui.plan(() => api.patch(`/api/x/vpn-pro/director/rules/${rule.index}`, { enabled: !rule.enabled }))) && refresh());
  const remove = async (rule) => {
    if (await confirmDialog({ title: t(`Remove ${rule.desc}?`, `移除 ${rule.desc}？`), body: t("The device goes back to the router's normal route.", "裝置會返回路由器嘅正常路線。"), confirm: t("Preview", "預覽"), danger: true }) && (await ui.plan(() => api.del(`/api/x/vpn-pro/director/rules/${rule.index}`)))) refresh();
  };
  return ui.card(
    ui.headRow(t("Routing rules", "路由規則"), ctx.state.canWrite && data.merlin ? h("button", { class: "btn f sm", onClick: () => edit(null) }, icon("add", "sm"), t("Add a rule", "新增規則")) : null),
    h("div", { class: "t2" }, t("Rules are checked from the top. A device with no rule uses the router's normal route.", "規則由上而下檢查。冇規則嘅裝置用路由器嘅正常路線。")),
    d.rules.length
      ? d.rules.map((r) => h("div", { class: "row" }, icon(r.enabled ? "alt_route" : "block"),
        h("div", { class: "grow" }, h("div", { class: "t1" }, r.desc, " ", r.enabled ? null : h("span", { class: "tag" }, t("Off", "停用"))),
          h("div", { class: "t2 mono" }, r.local, r.remote ? ` → ${r.remote}` : "", " · ", tt(where(r.iface))),
          policyProblem(data, r.iface) ? h("div", { class: "t2" }, icon("warning", "sm"), " ", t(`${tt(where(r.iface))} is not set to follow policy rules, so this rule does nothing yet.`, `${tt(where(r.iface))} 未設定為跟規則，所以呢條規則暫時冇作用。`)) : null),
        ctx.state.canWrite && data.merlin ? [h("button", { class: "btn t sm", role: "switch", "aria-checked": String(r.enabled), onClick: () => toggle(r) }, r.enabled ? t("Turn off", "停用") : t("Turn on", "啟用")), h("button", { class: "btn t icon", "aria-label": t(`Edit ${r.desc}`, `編輯 ${r.desc}`), onClick: () => edit(r) }, icon("edit", "sm")), h("button", { class: "btn t icon", "aria-label": t(`Remove ${r.desc}`, `移除 ${r.desc}`), onClick: () => remove(r) }, icon("delete", "sm"))] : null))
      : ui.empty(t("No rules yet.", "未有規則。")));
}

export function directorSection(ctx, ui, data, refresh) {
  const { h, t, icon } = ctx;
  return [
    !data.merlin ? h("div", { class: "note warn" }, icon("lock"), h("div", {}, t("VPN Director needs Asuswrt-Merlin firmware. This router runs the stock ASUS firmware, so the rules below can be read but not changed.", "VPN Director 要用 Asuswrt-Merlin 韌體。呢部路由器用緊原廠 ASUS 韌體，所以下面嘅規則只可以睇，唔可以改。"))) : null,
    ctx.controls.groupCard({ en: "VPN Director", yue: "VPN Director" }, data.entries.filter((e) => e.group === "director")),
    rulesCard(ctx, ui, data, refresh),
    ui.card(ui.headRow(t("VPN Fusion", "VPN Fusion")),
      h("div", { class: "t2" }, t("The stock firmware keeps its own list of VPN profiles. Here they are listed so you can see them; changing them is In progress, so use the router's own VPN page for now.", "原廠韌體有自己嘅 VPN 設定清單。呢度只列出嚟畀你睇；修改功能仍然進行中，暫時請用路由器自己嘅 VPN 頁面。")),
      data.fusion.profiles.length ? data.fusion.profiles.map((p) => h("div", { class: "row" }, icon("vpn_key"), h("div", { class: "grow" }, h("div", { class: "t1" }, p.name), h("div", { class: "t2 mono" }, [p.type, p.server].filter(Boolean).join(" · "))), h("span", { class: "tag" }, t("Read only", "只讀")))) : ui.empty(data.fusion.available ? t("No VPN Fusion profiles.", "未有 VPN Fusion 設定。") : t("This router has no VPN Fusion.", "呢部路由器冇 VPN Fusion。"))),
  ];
}

export function ipsecSection(ctx, ui, data) {
  const { h, t, icon } = ctx;
  const entries = data.entries.filter((e) => e.group === "ipsec");
  return [
    h("div", { class: "note" }, icon("info"), h("div", {}, t("IPsec is only on some router models. Where this one cannot do it, the switch stays visible but off, with the reason.", "只有部分型號有 IPsec。呢部做唔到嘅話，開關仍然會顯示但停用，並寫明原因。"))),
    ctx.controls.groupCard({ en: "IPsec VPN server", yue: "IPsec VPN 伺服器" }, entries),
  ];
}
