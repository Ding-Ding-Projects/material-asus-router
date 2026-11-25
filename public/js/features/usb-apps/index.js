// The USB apps screen: drives and disk usage with safe eject, file sharing
// accounts and shares with permissions, media folders and Time Machine.
import { createUi } from "./ui.js";

const label = { en: "USB apps", yue: "USB 應用" };
const lede = { en: "Share a USB drive on your network, choose who may open it and see how full it is.", yue: "喺網絡分享 USB 磁碟、揀邊個可以開，同睇用咗幾多空間。" };

export const formatSize = (kb) => {
  const units = ["KB", "MB", "GB", "TB"];
  let n = Number(kb) || 0;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
};

// 0 to 4: a rough strength for the password meter. Length and variety only.
export function passwordStrength(text) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(text)).length;
  if (text.length < 8) return 0;
  return Math.min(4, 1 + (text.length >= 12 ? 1 : 0) + (classes >= 3 ? 1 : 0) + (text.length >= 16 && classes >= 3 ? 1 : 0));
}

// A dialog that walks the folders of the USB drives and returns the chosen path.
function pickFolder(ctx, ui, start = "") {
  const { api, h, t, icon } = ctx;
  if (start === "/tmp/mnt") start = "";
  let path = start;
  const list = h("div", {});
  const where = h("div", { class: "t2 mono" });
  const dialog = ctx.openDialog((close) => {
    const go = async (next) => {
      try {
        const out = await api.get(`/api/x/usb-apps/folders${next ? `?path=${encodeURIComponent(next)}` : ""}`);
        path = out.path;
        where.textContent = path;
        list.replaceChildren(
          path.split("/").length > 3 ? h("button", { class: "row btn t", onClick: () => { const parent = path.split("/").slice(0, -1).join("/"); go(parent === "/tmp/mnt" ? "" : parent); } }, icon("arrow_upward", "sm"), t("Up one folder", "返上一層")) : null,
          out.folders.length ? out.folders.map((n) => h("button", { class: "row btn o", onClick: () => go(`${path}/${n}`) }, icon("folder", "sm"), n)) : ui.empty(t("No folders here.", "呢度冇資料夾。")));
      } catch (error) {
        list.replaceChildren(h("div", { class: "note bad" }, icon("error"), h("div", {}, error.message)));
      }
    };
    go(start);
    return [
      h("h2", { class: "h2" }, t("Choose a folder", "揀資料夾")),
      where,
      list,
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close(path.split("/").length > 3 ? path : null) }, icon("check", "sm"), t("Use this folder", "用呢個資料夾"))),
    ];
  }, { label: t("Choose a folder", "揀資料夾") });
  return dialog.closed;
}

function drivesCard(ctx, ui, data, refresh) {
  const { h, t, icon, api, toast } = ctx;
  const eject = async (drive) => {
    const keys = await ui.superConfirm({ title: t("Safely remove this drive?", "安全移除呢個磁碟？"), body: t("Sharing from this drive stops and any file that is open on it may be cut off. Wait until the router says it is safe to unplug.", "呢個磁碟嘅分享會停止，開住嘅檔案可能會中斷。請等路由器講可以拔先好拔。"), action: t("Eject", "退出"), typeModel: false });
    if (!keys) return;
    try {
      const out = await api.post("/api/actions/usb-apps.eject", { port: drive.port, hold: keys.hold });
      toast(out.message, out.ok ? "" : "bad");
    } catch (error) {
      toast(error.message, "bad");
    }
    refresh();
  };
  const rows = data.drives.map((d, i) => {
    const mount = data.mounts[i];
    const bar = h("i", {});
    bar.style.setProperty("--w", `${mount?.usedPct ?? 0}%`);
    return h("div", { class: "drive" },
      h("div", { class: "row" }, icon("usb"), h("div", { class: "grow" }, h("div", { class: "t1" }, [d.manufacturer, d.product].filter(Boolean).join(" ") || t("USB drive", "USB 磁碟")), h("div", { class: "t2" }, t(`USB port ${d.port}`, `USB 埠 ${d.port}`), mount ? ` · ${mount.mount}` : "")),
        ctx.state.canWrite ? h("button", { class: "btn t sm", onClick: () => eject(d) }, icon("eject", "sm"), t("Safely remove", "安全移除")) : null),
      mount
        ? [h("div", { class: `meter ${mount.usedPct >= 95 ? "bad" : mount.usedPct >= 85 ? "warn" : ""}`, role: "meter", "aria-label": t("Space used", "已用空間"), "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(mount.usedPct) }, bar),
          h("div", { class: "t2" }, t(`${formatSize(mount.usedKb)} used of ${formatSize(mount.totalKb)} (${mount.usedPct}%), ${formatSize(mount.freeKb)} free`, `已用 ${formatSize(mount.usedKb)} / ${formatSize(mount.totalKb)}（${mount.usedPct}%），尚餘 ${formatSize(mount.freeKb)}`))]
        : h("div", { class: "t2" }, t("Not mounted, so there is no usage to show.", "未掛載，所以冇用量可以顯示。")));
  });
  return ui.card(ui.headRow(t("Drives", "磁碟")), rows.length ? rows : ui.empty(t("No USB drive is plugged in.", "冇插入任何 USB 磁碟。")));
}

function accountsCard(ctx, ui, data, refresh) {
  const { h, t, icon, api, confirmDialog } = ctx;
  const strengthWords = [t("Too short", "太短"), t("Weak", "弱"), t("Fair", "一般"), t("Good", "好"), t("Strong", "好強")];
  const passwordField = (onChange) => {
    const word = h("span", { class: "t2" }, strengthWords[0]);
    const bar = h("i", {});
    const box = h("div", { class: "meter strength" }, bar);
    return { word, box, input: h("input", { class: "field", type: "password", autocomplete: "new-password", maxlength: "32", "aria-label": t("Password", "密碼"), onInput: (e) => { const s = passwordStrength(e.target.value); bar.style.setProperty("--w", `${s * 25}%`); box.className = `meter strength ${s < 2 ? "bad" : s < 3 ? "warn" : ""}`; word.textContent = strengthWords[s]; onChange(e.target.value); } }) };
  };
  const edit = (account) => {
    let name = account?.name ?? "";
    let password = "";
    const field = passwordField((v) => (password = v));
    const dialog = ctx.openDialog((close) => [
      h("h2", { class: "h2" }, account ? t(`Change the password for ${account.name}`, `改 ${account.name} 嘅密碼`) : t("Add a sharing account", "新增分享帳戶")),
      account ? null : h("label", { class: "lbl" }, t("Account name", "帳戶名稱"), h("input", { class: "field", maxlength: "20", autocomplete: "off", onInput: (e) => (name = e.target.value.trim()) })),
      h("label", { class: "lbl" }, t("Password (8 to 32 characters)", "密碼（8 至 32 個字元）"), field.input, field.box, field.word),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: async () => {
        try {
          close(account ? await api.patch(`/api/x/usb-apps/accounts/${encodeURIComponent(account.name)}`, { password }) : await api.post("/api/x/usb-apps/accounts", { name, password }));
        } catch (error) {
          ctx.toast(error.message, "bad");
        }
      } }, t("Preview", "預覽"))),
    ], { label: t("Sharing account", "分享帳戶") });
    dialog.closed.then(async (preview) => preview && (await ui.review(preview).closed) && refresh());
  };
  const remove = async (a) => {
    if (await confirmDialog({ title: t(`Remove ${a.name}?`, `移除 ${a.name}？`), body: t("The account loses access to every share.", "呢個帳戶將唔可以再開任何分享。"), confirm: t("Preview", "預覽"), danger: true }) && await ui.plan(() => api.del(`/api/x/usb-apps/accounts/${encodeURIComponent(a.name)}`)) ) refresh();
  };
  return ui.card(
    ui.headRow(t("Sharing accounts", "分享帳戶"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: () => edit(null) }, icon("person_add", "sm"), t("Add an account", "新增帳戶")) : null),
    h("div", { class: "t2" }, t("Passwords are never shown. Choose one that is not used anywhere else.", "密碼唔會顯示。請用一個冇喺其他地方用過嘅密碼。")),
    data.accounts.length ? data.accounts.map((a) => h("div", { class: "row" }, icon("account_circle"), h("div", { class: "grow t1" }, a.name),
      ctx.state.canWrite ? [h("button", { class: "btn t sm", onClick: () => edit(a) }, icon("key", "sm"), t("New password", "新密碼")), h("button", { class: "btn t icon", "aria-label": t(`Remove ${a.name}`, `移除 ${a.name}`), onClick: () => remove(a) }, icon("delete", "sm"))] : null)) : ui.empty(t("No accounts yet.", "未有帳戶。")));
}

function sharesCard(ctx, ui, data, refresh) {
  const { h, t, icon, api } = ctx;
  const editShare = (share) => {
    const v = { name: share?.name ?? "", path: share?.path ?? "", access: Object.fromEntries(data.accounts.map((a) => [a.name, share?.write.includes(a.name) ? "write" : share?.read.includes(a.name) ? "read" : "none"])) };
    const pathText = h("div", { class: "t2 mono" }, v.path || t("No folder chosen", "未揀資料夾"));
    const dialog = ctx.openDialog((close) => [
      h("h2", { class: "h2" }, share ? t(`Edit ${share.name}`, `編輯 ${share.name}`) : t("Add a share", "新增分享")),
      h("label", { class: "lbl" }, t("Share name", "分享名稱"), h("input", { class: "field", maxlength: "32", value: v.name, autocomplete: "off", onInput: (e) => (v.name = e.target.value.trim()) })),
      h("div", { class: "lbl" }, t("Folder", "資料夾"), pathText, h("div", {}, h("button", { class: "btn t sm", onClick: async () => { const chosen = await pickFolder(ctx, ui, v.path.split("/").slice(0, -1).join("/")); if (chosen) { v.path = chosen; pathText.textContent = chosen; } } }, icon("folder_open", "sm"), t("Choose a folder", "揀資料夾")))),
      h("div", { class: "lbl" }, t("Who can do what", "邊個可以做咩"),
        data.accounts.length ? data.accounts.map((a) => h("div", { class: "row" }, h("div", { class: "grow t1" }, a.name),
          h("select", { class: "field", "aria-label": t(`Access for ${a.name}`, `${a.name} 嘅權限`), onChange: (e) => (v.access[a.name] = e.target.value) }, [["none", t("No access", "冇權限")], ["read", t("Read only", "只讀")], ["write", t("Read and change", "讀同改")]].map(([value, text]) => h("option", { value, selected: v.access[a.name] === value }, text))))) : h("div", { class: "t2" }, t("Add a sharing account first.", "請先新增分享帳戶。"))),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: async () => {
        const names = Object.keys(v.access);
        try {
          close(await api.post("/api/x/usb-apps/shares", { index: share?.index, name: v.name, path: v.path, read: names.filter((n) => v.access[n] !== "none"), write: names.filter((n) => v.access[n] === "write") }));
        } catch (error) {
          ctx.toast(error.message, "bad");
        }
      } }, t("Preview", "預覽"))),
    ], { label: t("Share", "分享") });
    dialog.closed.then(async (preview) => preview && (await ui.review(preview).closed) && refresh());
  };
  return ui.card(
    ui.headRow(t("Shares", "分享"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: () => editShare(null) }, icon("create_new_folder", "sm"), t("Add a share", "新增分享")) : null),
    data.shares.length ? data.shares.map((s) => h("div", { class: "row" }, icon("folder_shared"), h("div", { class: "grow" }, h("div", { class: "t1" }, s.name), h("div", { class: "t2 mono" }, s.path),
      h("div", { class: "chips" }, s.read.map((n) => h("span", { class: "chip" }, n, " · ", s.write.includes(n) ? t("read and change", "讀同改") : t("read", "只讀"))))),
      ctx.state.canWrite ? [h("button", { class: "btn t icon", "aria-label": t(`Edit ${s.name}`, `編輯 ${s.name}`), onClick: () => editShare(s) }, icon("edit", "sm")),
        h("button", { class: "btn t icon", "aria-label": t(`Remove ${s.name}`, `移除 ${s.name}`), onClick: async () => ((await ui.plan(() => api.del(`/api/x/usb-apps/shares/${s.index}`))) && refresh()) }, icon("delete", "sm"))] : null)) : ui.empty(t("No shares yet.", "未有分享。")));
}

function mediaCard(ctx, ui, data, refresh) {
  const { h, t, icon, api } = ctx;
  const add = async () => {
    const path = await pickFolder(ctx, ui, "");
    if (path && (await ui.plan(() => api.post("/api/x/usb-apps/media-folders", { path })))) refresh();
  };
  return ui.card(
    ui.headRow(t("Media server folders", "媒體伺服器資料夾"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: add }, icon("add", "sm"), t("Add a folder", "加入資料夾")) : null),
    h("div", { class: "t2" }, t("TVs and speakers can play music, video and pictures from these folders.", "電視同喇叭可以播放呢啲資料夾入面嘅音樂、影片同相片。")),
    data.mediaFolders.length ? data.mediaFolders.map((f, i) => h("div", { class: "row" }, icon("perm_media"), h("div", { class: "grow t1 mono" }, f),
      ctx.state.canWrite ? h("button", { class: "btn t icon", "aria-label": t(`Remove ${f}`, `移除 ${f}`), onClick: async () => ((await ui.plan(() => api.del(`/api/x/usb-apps/media-folders/${i}`))) && refresh()) }, icon("delete", "sm")) : null)) : ui.empty(t("No folders are shared with the media server.", "未有資料夾分享畀媒體伺服器。")));
}

async function draw(ctx, root) {
  const ui = createUi(ctx);
  const { api } = ctx;
  const data = await api.get("/api/domain/usb-apps");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  const refresh = () => draw(ctx, root);
  const group = (id) => ctx.controls.settingGroups(data.entries.filter((e) => e.group === id)).map((g) => ctx.controls.groupCard(g.label, g.entries));
  page.append(
    drivesCard(ctx, ui, data, refresh),
    ctx.controls.groupCard({ en: "Services", yue: "服務" }, data.related),
    ...group("samba"),
    accountsCard(ctx, ui, data, refresh),
    sharesCard(ctx, ui, data, refresh),
    ...group("ftp"),
    ...group("media"),
    mediaCard(ctx, ui, data, refresh),
    ...group("tm"));
}

export default {
  id: "usb-apps",
  screens: [
    {
      id: "usb-apps",
      group: { en: "Router", yue: "路由器" },
      icon: "usb",
      label,
      async render(ctx) {
        await draw(ctx, ctx.root);
        return ctx.bus.on("changed", () => draw(ctx, ctx.root));
      },
    },
  ],
  settings: [
    {
      id: "usb-apps",
      icon: "usb",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/usb-apps");
        return ctx.controls.settingGroups(data.entries.filter((e) => e.group !== "accounts")).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],
  commands: [
    { id: "usb-apps.open", icon: "usb", label: { en: "Open USB apps", yue: "開啟 USB 應用" }, keywords: "usb drive share samba ftp media time machine eject", run: (ctx) => ctx.navigate("usb-apps") },
    { id: "usb-apps.shares", icon: "folder_shared", label: { en: "Manage USB shares and accounts", yue: "管理 USB 分享同帳戶" }, keywords: "samba account password permission", run: (ctx) => ctx.navigate("usb-apps") },
  ],
};
