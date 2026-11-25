// WireGuard on the VPN screen: the server, its devices (keys are made on the
// server, shown once as a QR code and a file) and the five clients.
import { download, notes, shown } from "./openvpn.js";
import { encodeQr } from "./qr.js";

// Draws a QR matrix on a canvas with the quiet zone the scanners need.
export function drawQr(canvas, qr, scale = 5) {
  const quiet = 4;
  const side = (qr.size + quiet * 2) * scale;
  canvas.width = side;
  canvas.height = side;
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, side, side);
  g.fillStyle = "#000000";
  qr.modules.forEach((row, y) => row.forEach((dark, x) => dark && g.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale)));
}

// One device's configuration: a QR code to scan, the text, a file and a copy button.
function showConfig(ctx, first, regenerate) {
  const { h, t, icon, toast } = ctx;
  let config = first;
  const canvas = h("canvas", { class: "qr", role: "img", "aria-label": t("QR code of the device configuration", "裝置設定嘅 QR 碼") });
  const text = h("pre", { class: "fp config" });
  const problem = h("div", { class: "note warn", hidden: true });
  const paint = () => {
    text.textContent = config.text;
    try {
      drawQr(canvas, encodeQr(config.text, "M"));
      canvas.hidden = false;
      problem.hidden = true;
    } catch {
      canvas.hidden = true;
      problem.hidden = false;
      problem.replaceChildren(icon("warning"), h("div", {}, t("This configuration is too long for a QR code. Use the file instead.", "呢份設定太長，QR 碼放唔晒。請用檔案。")));
    }
  };
  const mode = (value, label) => h("button", { role: "radio", "aria-checked": "false", class: value === "full" ? "on" : "", onClick: async (e) => {
    try {
      config = await regenerate(value);
      e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === e.currentTarget); b.setAttribute("aria-checked", String(b === e.currentTarget)); });
      paint();
    } catch (error) {
      toast(error.message, "bad");
    }
  } }, label);
  const dialog = ctx.openDialog((close) => {
    paint();
    return [
      h("h2", { class: "h2" }, t("Set up the device", "設定裝置")),
      h("div", { class: "note warn" }, icon("key"), h("div", {}, t("This holds the device's private key. Anyone who scans or copies it can connect to your network. Close this window when the device is set up; it is not kept here.", "入面有裝置嘅私密金鑰。任何人掃描或複製都可以連入你嘅網絡。裝置設定好之後請關閉視窗，呢度唔會保留。"))),
      ...notes(ctx, config.warnings ?? []),
      regenerate ? h("div", { class: "seg", role: "radiogroup", "aria-label": t("What goes through the VPN", "邊啲流量經 VPN") }, mode("full", t("All internet traffic", "所有互聯網流量")), mode("lan", t("Only the home network", "只限屋企網絡"))) : null,
      h("div", { class: "qrbox" }, canvas, problem),
      text,
      h("div", { class: "actions" },
        h("button", { class: "btn t", onClick: async () => { try { await navigator.clipboard.writeText(config.text); toast(t("Copied.", "已複製。")); } catch { toast(t("Copy is not available here. Select the text instead.", "呢度用唔到複製，請選取文字。"), "bad"); } } }, icon("content_copy", "sm"), t("Copy", "複製")),
        h("button", { class: "btn t", onClick: () => download(config.filename, config.text) }, icon("download", "sm"), t("Download the file", "下載檔案")),
        h("button", { class: "btn f", onClick: () => close() }, t("Done", "完成"))),
    ];
  }, { label: t("Device configuration", "裝置設定") });
  dialog.closed.then(() => {
    text.textContent = "";
    config = null;
  });
}

function peersCard(ctx, ui, data, refresh) {
  const { api, h, t, icon, confirmDialog, toast } = ctx;
  const wg = data.wireguard;
  const add = () => ui.form({
    title: t("Add a device", "新增裝置"),
    intro: t("The router makes the keys. You will see a QR code to scan with the WireGuard app.", "路由器會建立金鑰。你會見到 QR 碼，用 WireGuard 程式掃描。"),
    fields: [
      { name: "name", label: { en: "Device name", yue: "裝置名稱" }, maxlength: 32 },
      { name: "networks", label: { en: "Extra networks behind it (optional)", yue: "後面嘅額外網絡（可選）" }, type: "textarea", rows: 2, hint: { en: "One per line, such as 203.0.113.0/24", yue: "每行一個，例如 203.0.113.0/24" } },
    ],
    submitLabel: t("Preview", "預覽"),
    async submit(values) {
      const out = await api.post("/api/x/vpn-pro/wireguard/peers", { name: values.name, allowedIps: values.networks.split("\n").map((l) => l.trim()).filter(Boolean) });
      setTimeout(async () => {
        if (await ui.review(out.preview, { title: t(`Add ${out.peer.name}`, `新增 ${out.peer.name}`) }).closed) {
          showConfig(ctx, out.config, (mode) => api.post(`/api/x/vpn-pro/wireguard/peers/${encodeURIComponent(out.peer.name)}/config`, { mode }));
          refresh();
        }
      }, 0);
    },
  });
  const edit = (peer) => ui.form({
    title: t(`Networks behind ${peer.name}`, `${peer.name} 後面嘅網絡`),
    intro: t(`${peer.address}/32 is always allowed. Add other networks, one per line.`, `${peer.address}/32 一定容許。其他網絡每行加一個。`),
    fields: [{ name: "networks", label: { en: "Extra networks", yue: "額外網絡" }, type: "textarea", rows: 3, value: peer.allowedIps.filter((c) => c !== `${peer.address}/32`).join("\n") }],
    submitLabel: t("Preview", "預覽"),
    async submit(values) {
      const preview = await api.patch(`/api/x/vpn-pro/wireguard/peers/${encodeURIComponent(peer.name)}`, { allowedIps: values.networks.split("\n").map((l) => l.trim()).filter(Boolean) });
      setTimeout(async () => ((await ui.review(preview, { title: t(`Change ${peer.name}`, `修改 ${peer.name}`) }).closed) && refresh()), 0);
    },
  });
  const show = async (peer) => {
    try {
      const first = await api.post(`/api/x/vpn-pro/wireguard/peers/${encodeURIComponent(peer.name)}/config`, { mode: "full" });
      showConfig(ctx, first, (mode) => api.post(`/api/x/vpn-pro/wireguard/peers/${encodeURIComponent(peer.name)}/config`, { mode }));
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  const remove = async (peer) => {
    if (await confirmDialog({ title: t(`Remove ${peer.name}?`, `移除 ${peer.name}？`), body: t("The device can no longer connect and its keys stop working.", "裝置將唔可以再連線，佢嘅金鑰亦會失效。"), confirm: t("Preview", "預覽"), danger: true }) && (await ui.plan(() => api.del(`/api/x/vpn-pro/wireguard/peers/${encodeURIComponent(peer.name)}`)))) refresh();
  };
  return ui.card(
    ui.headRow(t("Devices", "裝置"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: add }, icon("add", "sm"), t("Add a device", "新增裝置")) : null),
    h("div", { class: "t2" }, t("Phones and laptops that may connect. Private keys never leave the router except when you ask to set up a device.", "可以連線嘅手機同電腦。除非你要求設定裝置，否則私密金鑰唔會離開路由器。")),
    wg.peers.length
      ? wg.peers.map((p) => h("div", { class: "row" }, icon("smartphone"), h("div", { class: "grow" }, h("div", { class: "t1" }, p.name, " ", p.hasPsk ? h("span", { class: "tag good" }, icon("lock", "sm"), t("Extra secret", "額外保密")) : null), h("div", { class: "t2 mono" }, p.allowedIps.join(", ")), h("div", { class: "t2 mono" }, p.publicKey)),
        ctx.state.canWrite ? [h("button", { class: "btn t sm", onClick: () => show(p) }, icon("qr_code_2", "sm"), t("QR code", "QR 碼")), h("button", { class: "btn t icon", "aria-label": t(`Edit ${p.name}`, `編輯 ${p.name}`), onClick: () => edit(p) }, icon("edit", "sm")), h("button", { class: "btn t icon", "aria-label": t(`Remove ${p.name}`, `移除 ${p.name}`), onClick: () => remove(p) }, icon("delete", "sm"))] : null))
      : ui.empty(t("No devices yet.", "未有裝置。")));
}

export function serverSection(ctx, ui, data, refresh) {
  const own = shown(data.entries).filter((e) => e.group === "wg-server");
  return [
    ...notes(ctx, data.endpoint.warnings),
    ctx.controls.groupCard({ en: "Server", yue: "伺服器" }, data.related.filter((e) => e.id.startsWith("vpn.wireguard"))),
    ...ctx.controls.settingGroups(own).map((g) => ctx.controls.groupCard(g.label, g.entries)),
    peersCard(ctx, ui, data, refresh),
  ];
}

export function clientsSection(ctx, ui, data, refresh, state) {
  const { h, t } = ctx;
  const unit = state.wgUnit;
  const entries = data.entries.filter((e) => e.group === `wgc${unit}`);
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("WireGuard client", "WireGuard 客戶端") }, [1, 2, 3, 4, 5].map((n) => h("button", { role: "radio", "aria-checked": String(n === unit), class: n === unit ? "on" : "", onClick: () => { state.wgUnit = n; refresh(); } }, t(`Client ${n}`, `客戶端 ${n}`))));
  return [tabs, ctx.controls.groupCard(entries[0].groupLabel, entries)];
}
