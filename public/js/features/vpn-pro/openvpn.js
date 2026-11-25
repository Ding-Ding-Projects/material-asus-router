// OpenVPN on the VPN screen: the server (settings, accounts, profile download)
// and the five clients (settings, start-up choice and profile import).

const HIDDEN = new Set(["vpn-pro.ovpn.users", "vpn-pro.wg.peers", "vpn-pro.wg.private"]);
export const shown = (entries) => entries.filter((e) => !HIDDEN.has(e.id));

export function download(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const notes = (ctx, list) => list.map((w) => ctx.h("div", { class: "note warn" }, ctx.icon("warning"), ctx.h("div", {}, ctx.tt(w))));

function accountsCard(ctx, ui, data, refresh) {
  const { api, h, t, icon, confirmDialog } = ctx;
  const add = () => ui.form({
    title: t("Add a VPN account", "新增 VPN 帳戶"),
    fields: [
      { name: "name", label: { en: "Account name", yue: "帳戶名稱" }, maxlength: 32 },
      { name: "password", label: { en: "Password (8 to 32 characters)", yue: "密碼（8 至 32 個字元）" }, type: "password", maxlength: 32 },
    ],
    submitLabel: t("Preview", "預覽"),
    async submit(values) {
      const preview = await api.post("/api/x/vpn-pro/openvpn/users", values);
      setTimeout(async () => ((await ui.review(preview, { title: t("Add this VPN account", "新增呢個 VPN 帳戶") }).closed) && refresh()), 0);
    },
  });
  const remove = async (user) => {
    if (await confirmDialog({ title: t(`Remove ${user.name}?`, `移除 ${user.name}？`), body: t("This account can no longer connect.", "呢個帳戶將唔可以再連線。"), confirm: t("Preview", "預覽"), danger: true }) && (await ui.plan(() => api.del(`/api/x/vpn-pro/openvpn/users/${encodeURIComponent(user.name)}`)))) refresh();
  };
  return ui.card(
    ui.headRow(t("VPN accounts", "VPN 帳戶"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: add }, icon("person_add", "sm"), t("Add an account", "新增帳戶")) : null),
    h("div", { class: "t2" }, t("Used when the server asks for a user name and password. Passwords are never shown.", "伺服器要求用戶名稱同密碼時使用。密碼唔會顯示。")),
    data.openvpn.users.length
      ? data.openvpn.users.map((u) => h("div", { class: "row" }, icon("account_circle"), h("div", { class: "grow t1" }, u.name), ctx.state.canWrite ? h("button", { class: "btn t icon", "aria-label": t(`Remove ${u.name}`, `移除 ${u.name}`), onClick: () => remove(u) }, icon("delete", "sm")) : null))
      : ui.empty(t("No accounts yet.", "未有帳戶。")));
}

export function serverSection(ctx, ui, data, refresh) {
  const { api, h, t, icon, toast } = ctx;
  const related = data.related.filter((e) => e.id.startsWith("vpn.openvpn"));
  const own = shown(data.entries).filter((e) => e.group === "ovpn-server");
  const exportProfile = async () => {
    try {
      const out = await api.post("/api/x/vpn-pro/openvpn/export");
      download(out.filename, out.text);
      toast(t(`Saved ${out.filename}. Import it into the OpenVPN app on the device.`, `已儲存 ${out.filename}。喺裝置嘅 OpenVPN 程式匯入。`));
      return out.warnings;
    } catch (error) {
      toast(error.message, "bad");
      return [];
    }
  };
  const warn = h("div", {});
  return [
    ctx.controls.groupCard({ en: "Server", yue: "伺服器" }, related),
    ...ctx.controls.settingGroups(own).map((g) => ctx.controls.groupCard(g.label, g.entries)),
    ui.card(
      ui.headRow(t("Profile for a device", "裝置用嘅設定檔")),
      h("div", { class: "t2" }, t("A .ovpn file with the address, port, encryption and keys a phone or laptop needs. It holds keys, so keep it private.", "一個 .ovpn 檔案，包含手機或電腦需要嘅地址、端口、加密同金鑰。入面有金鑰，請妥善保管。")),
      h("div", { class: "actions" }, h("button", { class: "btn f", disabled: !ctx.state.canWrite, onClick: async () => warn.replaceChildren(...notes(ctx, (await exportProfile()).map((w) => ({ en: w.en, yue: w.yue })))) }, icon("download", "sm"), t("Download the profile", "下載設定檔"))),
      warn),
    accountsCard(ctx, ui, data, refresh),
  ];
}

function importCard(ctx, ui, unit, refresh) {
  const { api, h, t, icon, toast } = ctx;
  const drop = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": t(`Choose a profile for client ${unit}`, `為客戶端 ${unit} 揀設定檔`) }, icon("upload_file"), h("div", { class: "grow" }, h("div", { class: "t1" }, t("Import a provider profile (.ovpn)", "匯入供應商設定檔（.ovpn）")), h("div", { class: "t2" }, t("Drop the file here or press to choose it. Its server, port and protocol are filled in for you to review.", "將檔案拖到呢度，或者撳一下揀檔案。伺服器、端口同協定會預先填好，由你檢查。"))));
  const input = h("input", { type: "file", accept: ".ovpn,.conf,text/plain", hidden: true });
  const readFile = async (file) => {
    if (!file) return;
    if (file.size > 250 * 1024) return toast(t("That file is too large for a profile.", "個檔案太大，唔似係設定檔。"), "bad");
    try {
      const out = await api.post("/api/x/vpn-pro/openvpn/profile", { unit, filename: file.name, text: await file.text() });
      await new Promise((resolve) => ctx.openDialog((close) => [
        h("h2", { class: "h2" }, t(`What ${file.name} says`, `${file.name} 嘅內容`)),
        Object.entries(out.settings).map(([k, v]) => h("div", { class: "row" }, h("div", { class: "grow t1" }, { addr: t("Server", "伺服器"), port: t("Port", "端口"), proto: t("Protocol", "協定"), rgw: t("All traffic through the VPN", "全部流量經 VPN"), desc: t("Name", "名稱") }[k]), h("div", { class: "mono" }, k === "rgw" ? t("Yes", "係") : v))),
        out.needsLogin ? h("div", { class: "note" }, icon("info"), h("div", {}, t("This provider asks for an account name and password. Enter them below after applying.", "呢個供應商要求帳戶名稱同密碼。套用之後請喺下面輸入。"))) : null,
        out.certificates.length ? h("div", { class: "note warn" }, icon("construction"), h("div", {}, h("b", {}, t("In progress: ", "進行中：")), t(`The profile holds ${out.certificates.map((c) => c.name).join(", ")}. Certificates and keys are not stored yet because the change engine only handles single-line values. Add them on the router's own OpenVPN page.`, `設定檔包含 ${out.certificates.map((c) => c.name).join("、")}。證書同金鑰暫時未能儲存，因為變更引擎只處理單行數值。請喺路由器自己嘅 OpenVPN 頁面加入。`))) : null,
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: async () => { close(true); (await ui.review(out.preview, { title: t(`Fill in client ${unit}`, `填寫客戶端 ${unit}`) }).closed) && refresh(); } }, t("Review the settings", "檢查設定"))),
      ], { label: t("Profile contents", "設定檔內容") }).closed.then(resolve));
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  input.addEventListener("change", () => readFile(input.files[0]));
  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.click()));
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => (e.preventDefault(), drop.classList.remove("over"), readFile(e.dataTransfer.files[0])));
  return ui.card(drop, input);
}

export function clientsSection(ctx, ui, data, refresh, state) {
  const { h, t, tt } = ctx;
  const unit = state.ovpnUnit;
  const entries = shown(data.entries);
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("OpenVPN client", "OpenVPN 客戶端") }, [1, 2, 3, 4, 5].map((n) => {
    const on = data.openvpn.startAtBoot.includes(String(n));
    return h("button", { role: "radio", "aria-checked": String(n === unit), class: n === unit ? "on" : "", onClick: () => { state.ovpnUnit = n; refresh(); } }, t(`Client ${n}`, `客戶端 ${n}`), on ? h("span", { class: "dot", title: tt({ en: "Connects at start-up", yue: "開機時連線" }) }) : null);
  }));
  return [
    tabs,
    ctx.controls.groupCard({ en: "Connect at start-up", yue: "開機時連線" }, entries.filter((e) => e.group === "ovpnc-start")),
    ctx.controls.groupCard(entries.find((e) => e.group === `ovpnc${unit}`).groupLabel, entries.filter((e) => e.group === `ovpnc${unit}`)),
    ctx.state.canWrite ? importCard(ctx, ui, unit, refresh) : null,
  ];
}
