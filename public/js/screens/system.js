// System, maintenance, backup, firmware and the read-only hardware screens.
import { api, auth, clear, confirmDialog, copyText, h, icon, openDialog, t, toast, tt } from "../core.js";
import { app, runPreview } from "../dock.js";
import { groupCard, settingGroups } from "../controls.js";
import { header, loadDomain, settingsScreen, tableOf, unsupported } from "./common.js";

// ---- people ---------------------------------------------------------------------

async function peopleCard() {
  const holder = h("section", { class: "card" });
  const roleText = { operator: t("Operator: can change settings", "操作員：可以改設定"), viewer: t("Viewer: can only look", "檢視者：只可以睇") };
  async function paint() {
    const { owner, users } = await api.get("/api/users");
    clear(holder).append(
      h("div", { class: "row" }, h("div", { class: "grow" }, h("h2", { class: "h2" }, t("People", "用戶")), h("div", { class: "t2" }, t("The owner can do everything. Operators change settings. Viewers can only look.", "擁有者可以做所有嘢。操作員可以改設定。檢視者只可以睇。"))), h("button", { class: "btn f sm", onClick: addPerson }, icon("person_add", "sm"), t("Add person", "新增用戶"))),
      h("div", { class: "row" }, icon("shield_person"), h("div", { class: "grow" }, h("div", { class: "t1" }, owner.name), h("div", { class: "t2 mono" }, owner.username)), h("span", { class: "tag good" }, t("Owner", "擁有者"))),
      users.map((u) => h("div", { class: "row" }, icon("person"), h("div", { class: "grow" }, h("div", { class: "t1" }, u.name), h("div", { class: "t2 mono" }, u.username)),
        h("select", { class: "field", style: undefined, "aria-label": `${t("Role of", "角色：")} ${u.name}`, onChange: async (e) => { try { await api.patch(`/api/users/${u.id}`, { role: e.target.value }); toast(t("Role changed. They need to sign in again.", "角色已更改，佢哋要重新登入。")); } catch (err) { toast(err.message, "bad"); } } }, ["operator", "viewer"].map((r) => h("option", { value: r, selected: r === u.role }, roleText[r]))),
        h("button", { class: "btn t icon", "aria-label": `${t("Remove", "移除")} ${u.name}`, onClick: async () => { if (await confirmDialog({ title: t(`Remove ${u.name}?`, `移除 ${u.name}？`), body: t("They are signed out straight away.", "佢會即時被登出。"), confirm: t("Remove", "移除"), danger: true })) { await api.del(`/api/users/${u.id}`); paint(); } } }, icon("delete", "sm")))));
  }
  function addPerson() {
    const v = { name: "", username: "", password: "", role: "viewer" };
    openDialog((close) => [
      h("h2", { class: "h2" }, t("Add a person", "新增用戶")),
      h("div", { class: "two" }, h("label", { class: "lbl" }, t("Name", "名稱"), h("input", { class: "field", onInput: (e) => (v.name = e.target.value) })), h("label", { class: "lbl" }, t("User name", "用戶名稱"), h("input", { class: "field", autocomplete: "off", onInput: (e) => (v.username = e.target.value) }))),
      h("label", { class: "lbl" }, t("Password (12 characters or more)", "密碼（12 個字元或以上）"), h("input", { class: "field", type: "password", autocomplete: "new-password", onInput: (e) => (v.password = e.target.value) })),
      h("div", { class: "seg", role: "radiogroup" }, ["viewer", "operator"].map((r) => h("button", { role: "radio", class: v.role === r ? "on" : "", onClick: (e) => { v.role = r; e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); } }, roleText[r]))),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: async () => { try { await api.post("/api/users", v); close(); toast(t("Person added.", "已新增用戶。")); paint(); } catch (e) { toast(e.message, "bad"); } } }, t("Add", "新增"))),
    ]);
  }
  await paint();
  return holder;
}

// ---- SSH key and safety timer --------------------------------------------------

async function accessCard(data) {
  const router = await api.get("/api/router");
  const settings = await api.get("/api/settings");
  const holder = h("section", { class: "card" });
  function paint(r) {
    clear(holder).append(
      h("h2", { class: "h2" }, t("How this app signs in to the router", "呢個程式點樣登入路由器")),
      h("div", { class: "row" }, icon(r.authType === "key" ? "key" : "password"), h("div", { class: "grow" }, h("div", { class: "t1" }, r.authType === "key" ? t("The app's own SSH key", "程式自己嘅 SSH 金鑰") : t("Router password", "路由器密碼")), h("div", { class: "t2" }, `${r.username}@${r.host}:${r.port}`))),
      h("div", { class: "t2" }, t(`${data.ssh.keyCount} key${data.ssh.keyCount === 1 ? "" : "s"} allowed on the router.`, `路由器已容許 ${data.ssh.keyCount} 條金鑰。`)),
      r.publicKey ? h("div", {}, h("div", { class: "k" }, t("This app's public key", "程式嘅公開金鑰")), h("div", { class: "fp" }, r.publicKey), h("div", { class: "actions" }, h("button", { class: "btn t sm", onClick: () => copyText(r.publicKey) }, icon("content_copy", "sm"), t("Copy", "複製")))) : null,
      app.me.role === "owner" ? h("div", { class: "actions" },
        h("button", { class: "btn t sm", onClick: async () => { try { const res = await api.post("/api/router/key", { replace: r.authType !== "key" }); paint({ ...r, publicKey: res.publicKey, hasKey: true }); toast(t("New key created. Allow it on the router to use it.", "已建立新金鑰，請喺路由器容許佢先可以用。")); } catch (e) { toast(e.message, "bad"); } } }, icon("key", "sm"), r.hasKey ? t("Make a new key", "重新建立金鑰") : t("Create a key", "建立金鑰")),
        r.hasKey ? h("button", { class: "btn f sm", onClick: async () => { try { runPreview(await api.post("/api/actions/install-key"), { title: t("Allow this app's key on the router", "喺路由器容許程式嘅金鑰") }); } catch (e) { toast(e.message, "bad"); } } }, icon("vpn_key", "sm"), t("Allow key on router", "喺路由器容許金鑰")) : null) : null,
      h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, t("Safety net length", "安全機制時間")), h("div", { class: "t2" }, t("How long the router waits before putting old settings back if this app cannot reach it.", "如果呢個程式連唔到路由器，路由器等幾耐先還原舊設定。"))),
        h("input", { class: "field", type: "number", min: "20", max: "600", value: String(settings.guardSeconds), "aria-label": t("Safety net seconds", "安全機制秒數"), disabled: !app.canWrite, onChange: async (e) => { try { await api.post("/api/settings", { guardSeconds: Number(e.target.value) }); toast(t("Saved.", "已儲存。")); } catch (err) { toast(err.message, "bad"); } } }), h("span", { class: "muted" }, t("seconds", "秒"))),
      app.me.role === "owner" ? h("div", { class: "actions" }, h("button", { class: "btn o sm", onClick: async () => { if (await confirmDialog({ title: t("Forget this router?", "忘記呢部路由器？"), body: t("The saved password and host key are removed. Change history stays.", "已儲存嘅密碼同主機金鑰會被移除，變更記錄會保留。"), confirm: t("Forget", "忘記"), danger: true })) { await api.post("/api/router/forget"); location.reload(); } } }, icon("link_off", "sm"), t("Forget this router", "忘記呢部路由器"))) : null,
    );
  }
  paint(router);
  return holder;
}

export async function system(root) {
  await settingsScreen(root, "system", {
    extra: async (data) => [h("div", { class: "grid2" }, [await accessCard(data), app.me.role === "owner" ? await peopleCard() : null])],
  });
}

// ---- maintenance ----------------------------------------------------------------

function holdButton(onDone, disabled) {
  const fill = h("i");
  const label = h("span", {}, t("Press and hold to restart", "撳住唔放嚟重啟"));
  const button = h("button", { class: "btn d hold", disabled }, fill, icon("restart_alt", "sm"), label);
  let start = 0;
  let raf = 0;
  const step = () => {
    const pct = Math.min(100, ((performance.now() - start) / 2000) * 100);
    fill.style.setProperty("--w", `${pct}%`);
    if (pct >= 100) return stop(true);
    raf = requestAnimationFrame(step);
  };
  const stop = (done) => {
    cancelAnimationFrame(raf);
    fill.style.setProperty("--w", "0%");
    if (done === true) onDone();
    start = 0;
  };
  const begin = () => { if (!start) { start = performance.now(); raf = requestAnimationFrame(step); } };
  button.addEventListener("pointerdown", begin);
  for (const e of ["pointerup", "pointerleave", "pointercancel", "blur"]) button.addEventListener(e, () => start && stop(false));
  button.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") (e.preventDefault(), begin()); });
  button.addEventListener("keyup", (e) => { if (start && (e.key === " " || e.key === "Enter")) stop(false); });
  return button;
}

export async function maintenance(root) {
  const data = await loadDomain("maintenance");
  let typed = "";
  const result = h("div", { class: "muted" });
  root.append(h("div", { class: "page" }, header("maintenance"),
    h("section", { class: "card" }, h("h2", { class: "h2" }, t("Restart a part of the router", "重啟路由器嘅部分功能")), h("div", { class: "muted" }, t("Briefly interrupts that feature. Devices reconnect by themselves.", "該功能會短暫中斷，裝置會自動重新連線。")),
      h("div", { class: "chips" }, data.services.map((s) => h("button", { class: "btn t sm", disabled: !app.canWrite, onClick: async () => { try { await api.post("/api/actions/restart-service", { service: s.id }); toast(t(`${tt(s.label)} restarted.`, `${tt(s.label)} 已重啟。`)); } catch (e) { toast(e.message, "bad"); } } }, icon("restart_alt", "sm"), tt(s.label))))),
    h("section", { class: "card warn" }, h("h2", { class: "h2" }, t("Restart the whole router", "重啟成部路由器")),
      h("div", {}, t("Everything disconnects for a few minutes. This needs two steps so it cannot happen by accident.", "所有連線會中斷幾分鐘。要做兩步確認，避免誤撳。")),
      h("label", { class: "lbl" }, t(`1. Type the router model: ${data.confirmPhrase}`, `1. 輸入路由器型號：${data.confirmPhrase}`), h("input", { class: "field mono", autocomplete: "off", spellcheck: "false", disabled: !app.canWrite, onInput: (e) => (typed = e.target.value) })),
      h("div", { class: "t1" }, t("2. Press and hold the button for two seconds.", "2. 撳住個掣兩秒。")),
      holdButton(async () => { try { const res = await api.post("/api/actions/reboot", { confirm: typed, hold: true }); result.textContent = res.message; toast(res.message); } catch (e) { result.textContent = e.message; toast(e.message, "bad"); } }, !app.canWrite),
      result)));
}

// ---- backup and firmware --------------------------------------------------------

export async function backup(root) {
  const data = await loadDomain("backup");
  let withSecrets = false;
  const link = h("a", { class: "btn f", href: "/api/backup", download: "" }, icon("download", "sm"), t("Download backup", "下載備份"));
  root.append(h("div", { class: "page" }, header("backup"), h("div", { class: "grid2" },
    h("section", { class: "card" }, h("h2", { class: "h2" }, t("Save a backup", "儲存備份")), h("div", { class: "muted" }, `${data.model} · ${data.keyCount} ${t("settings", "項設定")}`), h("div", { class: "muted" }, tt(data.note)),
      app.me.role === "owner" ? h("label", { class: "row" }, h("input", { type: "checkbox", onChange: (e) => { withSecrets = e.target.checked; link.setAttribute("href", withSecrets ? "/api/backup?secrets=1" : "/api/backup"); } }), t("Include passwords and keys (keep the file private)", "包括密碼同金鑰（請妥善保管檔案）")) : null,
      h("div", { class: "actions" }, link)),
    h("section", { class: "card" }, h("h2", { class: "h2" }, t("Restore from a backup", "由備份還原")), h("div", { class: "muted" }, t("You see exactly what would change before anything is written.", "寫入之前，你會見到實際會改啲咩。")),
      h("label", { class: "btn t" }, icon("upload_file", "sm"), t("Choose a backup file", "揀備份檔案"), h("input", { type: "file", accept: "application/json,.json", class: "sr", disabled: !app.canWrite, async onChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const res = await api.post("/api/restore", { backup: JSON.parse(await file.text()) });
          if (res.skipped.length) toast(t(`${res.skipped.length} settings skipped (secrets or invalid values).`, `略過咗 ${res.skipped.length} 項（機密或者無效嘅值）。`));
          runPreview(res.preview, { title: t("Restore from backup", "由備份還原"), review: true });
        } catch (err) { toast(err.message, "bad"); }
        e.target.value = "";
      } }))))));
}

export async function firmware(root) {
  const data = await loadDomain("firmware");
  root.append(h("div", { class: "page" }, header("firmware"), h("section", { class: "card hero" }, h("div", { class: "k" }, data.model), h("div", { class: "big" }, data.version), h("div", {}, data.merlin ? "Asuswrt-Merlin" : t("Stock ASUS firmware", "原廠 ASUS 韌體"))), h("div", { class: "note" }, icon("info"), tt(data.note))));
}

// ---- hardware and extras --------------------------------------------------------

export async function aimesh(root) {
  const data = await loadDomain("aimesh");
  root.append(h("div", { class: "page" }, header("aimesh"),
    !data.supported ? unsupported("aimesh", { en: "This router model does not support AiMesh.", yue: "呢個型號唔支援 AiMesh。" })
      : data.nodes.length ? h("div", { class: "grid" }, data.nodes.map((n) => h("section", { class: "card rise" }, h("div", { class: "row" }, icon(n.role === "router" ? "router" : "hub"), h("div", { class: "grow" }, h("div", { class: "t1" }, n.role === "router" ? t("Main router", "主路由器") : t("Mesh node", "Mesh 節點")), h("div", { class: "t2 mono" }, n.ip))), h("div", { class: "t2 mono" }, n.mac), h("div", { class: "t2 mono" }, `${t("Backhaul", "回程")} ${n.backhaulMac}`))))
        : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("hub", "lg"), t("No mesh nodes.", "冇 mesh 節點。")))));
}

export async function usb(root) {
  await settingsScreen(root, "usb", {
    before: (data) => (data.drives.length ? h("div", { class: "grid" }, data.drives.map((d) => h("section", { class: "card ter rise" }, h("div", { class: "row" }, icon("usb"), h("div", { class: "grow" }, h("div", { class: "t1" }, d.product || t("USB device", "USB 裝置")), h("div", { class: "t2" }, `${d.manufacturer} · ${d.kind} · ${t("port", "端口")} ${d.port}`)))))) : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("usb_off", "lg"), t("No drive is plugged in.", "冇插任何磁碟。")))),
  });
}

export async function merlin(root) {
  await settingsScreen(root, "merlin", {
    before: (data) => (data.supported ? null : unsupported("merlin", { en: "This router runs the stock ASUS firmware, which does not have these extras.", yue: "呢部路由器用原廠 ASUS 韌體，冇呢啲附加功能。" })),
    extra: (data) => data.supported ? h("div", { class: "grid2" },
      h("section", { class: "card" }, h("h2", { class: "h2" }, t("Custom scripts", "自訂腳本")), data.scripts.length ? data.scripts.map((s) => h("div", { class: "row mono" }, icon("terminal", "sm"), s)) : h("div", { class: "muted" }, t("No scripts in /jffs/scripts.", "/jffs/scripts 冇腳本。"))),
      h("section", { class: "card" }, h("h2", { class: "h2" }, t("Add-ons", "附加元件")), data.addons.length ? data.addons.map((s) => h("div", { class: "row mono" }, icon("extension", "sm"), s)) : h("div", { class: "muted" }, t("No add-ons installed.", "未安裝附加元件。")), h("div", { class: "row" }, h("span", { class: `tag ${data.entware ? "good" : ""}` }, data.entware ? t("Entware installed", "已安裝 Entware") : t("Entware not installed", "未安裝 Entware"))))) : null,
  });
}
