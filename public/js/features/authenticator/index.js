// The built-in authenticator: a searchable, tabbed destination for time-based
// one-time codes. Codes come from the server (RFC 4226 and 6238, SHA-1/256/512,
// 6 to 8 digits, any period); secrets stay in the encrypted vault and are never
// in the list, the search, an ordinary export or the page. Showing or exporting
// secrets goes through the two-key super confirmation. No camera is used: add
// an account by otpauth address, base32 secret, file or pasted text.
import { createSelection, scopeText } from "./selection.js";

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
const label = { en: "Authenticator", yue: "驗證器" };
const group = { en: "Safety", yue: "安全" };
const NS = "http://www.w3.org/2000/svg";

function qrSvg(qr, description) {
  const total = qr.size + 8;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${total} ${total}`);
  svg.setAttribute("class", "au-qr");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", description);
  const back = document.createElementNS(NS, "rect");
  back.setAttribute("width", String(total));
  back.setAttribute("height", String(total));
  back.setAttribute("fill", "#fff");
  svg.append(back);
  const path = document.createElementNS(NS, "path");
  let d = "";
  qr.rows.forEach((row, y) => [...row].forEach((c, x) => c === "1" && (d += `M${x + 4} ${y + 4}h1v1h-1z`)));
  path.setAttribute("d", d);
  path.setAttribute("fill", "#000");
  svg.append(path);
  return svg;
}

const askSuper = (ctx, options) => new Promise((resolve) => {
  const detail = { ...options, claimed: false, respond: resolve };
  ctx.bus.emit("superconfirm:ask", detail);
  if (!detail.claimed) resolve(null);
});

const download = (h, name, text, type) => {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

async function render(ctx) {
  const { api, h, icon, t, toast } = ctx;
  const sel = createSelection();
  const view = { tab: "codes", q: "", regex: false, group: "", accounts: [], codes: new Map(), groups: [], error: "", page: 0 };
  const PAGE = 12;
  let timer = null;
  let loadedAt = 0;

  const root = h("div", { class: "au" });
  ctx.root.append(ctx.page(label, { en: "One-time codes for your other accounts. Secrets stay in the encrypted vault and never appear in lists or ordinary exports.", yue: "你其他帳戶嘅一次性驗證碼。密碼留喺加密保險庫，唔會出現喺列表或者一般匯出。" }, root));

  async function load() {
    const [list, codes] = await Promise.all([api.get("/api/x/authenticator/accounts"), api.get(`/api/x/authenticator/codes?clientTime=${Date.now()}`)]);
    view.accounts = list.accounts;
    view.groups = list.groups;
    view.codes = new Map(codes.codes.map((c) => [c.id, c]));
    view.skew = codes.clockWarning;
    loadedAt = performance.now();
    sel.keepOnly(view.accounts.map((a) => a.id));
    draw();
  }

  const matches = () => {
    view.error = "";
    let rows = view.accounts;
    if (view.group) rows = rows.filter((a) => a.group === view.group);
    if (!view.q) return rows;
    if (view.regex) {
      if (view.q.length > 120) return (view.error = t("Use 120 characters or fewer.", "請用 120 個字元或以下。")), [];
      try {
        const re = new RegExp(view.q, "i");
        return rows.filter((a) => re.test(`${a.issuer} ${a.label} ${a.group}`));
      } catch (error) {
        return (view.error = error.message), [];
      }
    }
    const q = view.q.toLowerCase();
    return rows.filter((a) => `${a.issuer} ${a.label} ${a.group}`.toLowerCase().includes(q));
  };

  const repaint = () => {
    root.lastChild.replaceWith(codesTab());
    clearInterval(timer);
    timer = setInterval(tick, 500);
  };
  const searchInput = h("input", { class: "field", type: "search", "aria-label": t("Search accounts", "搜尋帳戶"), placeholder: t("Search accounts", "搜尋帳戶"), onInput: (e) => { view.q = e.target.value; view.page = 0; repaint(); } });
  const regexInput = h("input", { type: "checkbox", onChange: (e) => { view.regex = e.target.checked; repaint(); } });
  const spaced = (code) => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code);
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast(t("Copied.", "已複製。")), () => toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad"));

  function tick() {
    const elapsed = (performance.now() - loadedAt) / 1000;
    let expired = false;
    root.querySelectorAll("[data-code-id]").forEach((el) => {
      const c = view.codes.get(el.dataset.codeId);
      if (!c || c.error) return;
      const left = Math.max(0, c.remaining - elapsed);
      el.querySelector(".au-left").textContent = `${Math.ceil(left)} s`;
      el.querySelector(".meter i").style.setProperty("--w", `${(left / c.period) * 100}%`);
      if (left <= 0) expired = true;
    });
    if (expired && view.tab === "codes") load().catch(() => {});
  }

  function draw() {
    clearInterval(timer);
    fill(root,
      h("div", { class: "seg au-tabs", role: "tablist", "aria-label": t("Authenticator sections", "驗證器分頁") }, [["codes", t("Codes", "驗證碼")], ["add", t("Add", "新增")], ["transfer", t("Import and export", "匯入同匯出")]].map(([id, text]) => h("button", { role: "tab", "aria-selected": String(view.tab === id), class: view.tab === id ? "on" : "", onClick: () => { view.tab = id; draw(); } }, text))),
      view.skew ? h("div", { class: "note warn" }, icon("schedule"), t(view.skew.en, view.skew.yue)) : null,
      view.tab === "codes" ? codesTab() : view.tab === "add" ? addTab() : transferTab());
    if (view.tab === "codes") timer = setInterval(tick, 500);
  }

  function codesTab() {
    const rows = matches();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    view.page = Math.min(view.page, pages - 1);
    const shown = rows.slice(view.page * PAGE, view.page * PAGE + PAGE);
    const ids = shown.map((a) => a.id);
    const scope = scopeText(t, shown.length, rows.length);
    const reorder = async (a, delta) => {
      const all = view.accounts.map((x) => x.id);
      const i = all.indexOf(a.id);
      const j = i + delta;
      if (j < 0 || j >= all.length) return;
      [all[i], all[j]] = [all[j], all[i]];
      await api.post("/api/x/authenticator/reorder", { ids: all });
      await load();
    };
    return h("div", { class: "au-pane", role: "tabpanel" },
      h("div", { class: "au-tools" },
        searchInput,
        h("label", { class: "au-rx" }, regexInput, t("Regex", "正則"))),
      view.groups.length ? h("div", { class: "chips", role: "group", "aria-label": t("Groups", "分組") }, [["", t("All", "全部")], ...view.groups.map((g) => [g, g])].map(([g, text]) => h("button", { class: `chip ${view.group === g ? "on" : ""}`, "aria-pressed": String(view.group === g), onClick: () => { view.group = g; repaint(); } }, text))) : null,
      h("p", { class: "muted", role: "status" }, view.error || t(`${rows.length} of ${view.accounts.length} accounts`, `${view.accounts.length} 個帳戶之中有 ${rows.length} 個`)),
      h("div", { class: "au-bulk", role: "group", "aria-label": t("Bulk actions", "批量動作") },
        h("button", { class: "btn o sm", onClick: () => { sel.selectAll(ids); repaint(); } }, scope.page),
        rows.length > shown.length ? h("button", { class: "btn o sm", onClick: () => { sel.selectAll(rows.map((a) => a.id)); repaint(); } }, scope.matches) : null,
        h("button", { class: "btn o sm", onClick: () => { sel.invert(ids); repaint(); } }, t("Invert", "反選")),
        h("button", { class: "btn o sm", disabled: !sel.size, onClick: () => { sel.clear(); repaint(); } }, t("Clear", "取消選取")),
        h("button", { class: "btn t sm", disabled: !sel.size, onClick: bulkGroup }, icon("folder", "sm"), t(`Group ${sel.size}`, `分組 ${sel.size} 個`)),
        h("button", { class: "btn d sm", disabled: !sel.size, onClick: bulkDelete }, icon("delete", "sm"), t(`Delete ${sel.size}`, `刪除 ${sel.size} 個`))),
      shown.length ? shown.map((a) => {
        const c = view.codes.get(a.id);
        return h("section", { class: `card au-card ${sel.has(a.id) ? "sel" : ""}`, "data-code-id": a.id },
          h("div", { class: "au-head" },
            h("input", { type: "checkbox", checked: sel.has(a.id), "aria-label": `${t("Select", "選取")} ${a.label}`, onClick: (e) => { sel.toggle(a.id, ids, { shift: e.shiftKey }); repaint(); } }),
            h("div", { class: "grow" }, h("strong", {}, a.issuer || a.label), a.issuer ? h("div", { class: "muted" }, a.label) : null, a.group ? h("span", { class: "tag" }, a.group) : null),
            h("button", { class: "icb", "aria-label": t("Move up", "上移"), onClick: () => reorder(a, -1) }, icon("arrow_upward", "sm")),
            h("button", { class: "icb", "aria-label": t("Move down", "下移"), onClick: () => reorder(a, 1) }, icon("arrow_downward", "sm")),
            h("button", { class: "icb", "aria-label": t("Show QR for another device", "喺另一部裝置顯示二維碼"), onClick: () => showQr(a) }, icon("qr_code_2", "sm")),
            h("button", { class: "icb", "aria-label": t("Rename", "改名"), onClick: () => rename(a) }, icon("edit", "sm"))),
          c?.error ? h("div", { class: "note bad" }, icon("error"), c.error) : [
            h("div", { class: "au-code mono", "aria-live": "off" }, spaced(c?.code ?? "")),
            h("div", { class: "au-meta" }, h("span", { class: "au-left" }, `${c?.remaining ?? ""} s`), h("span", { class: "muted" }, `${t("Next", "下一個")}: ${spaced(c?.next ?? "")}`), `${a.algorithm} · ${a.digits} · ${a.period}s`),
            h("div", { class: "meter" }, h("i", {})),
            h("div", { class: "actions" }, h("button", { class: "btn t sm", onClick: () => copy(c.code) }, icon("content_copy", "sm"), t("Copy code", "複製驗證碼")))]);
      }) : h("div", { class: "empty" }, icon("verified_user", "lg"), view.accounts.length ? t("No account matches.", "冇符合嘅帳戶。") : t("No accounts yet. Add one in the Add tab.", "仲未有帳戶，請喺「新增」分頁加一個。")),
      pages > 1 ? h("div", { class: "au-pager" }, h("button", { class: "btn o sm", disabled: view.page === 0, onClick: () => { view.page--; repaint(); } }, t("Previous", "上一頁")), `${view.page + 1} / ${pages}`, h("button", { class: "btn o sm", disabled: view.page >= pages - 1, onClick: () => { view.page++; repaint(); } }, t("Next", "下一頁"))) : null);
  }

  async function rename(a) {
    const name = h("input", { class: "field", value: a.label, "aria-label": t("Account name", "帳戶名稱") });
    const grp = h("input", { class: "field", value: a.group, list: "au-groups", "aria-label": t("Group", "分組") });
    const ok = await ctx.openDialog((close) => [h("h2", { class: "h2" }, t("Edit account", "編輯帳戶")), h("label", {}, t("Name", "名稱"), name), h("label", {}, t("Group", "分組"), grp), h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close(true) }, t("Save", "儲存")))], { label: t("Edit account", "編輯帳戶") }).closed;
    if (!ok) return;
    await api.patch(`/api/x/authenticator/accounts/${a.id}`, { label: name.value, group: grp.value });
    await load();
  }

  async function bulkGroup() {
    const grp = h("input", { class: "field", "aria-label": t("Group name", "分組名稱"), placeholder: t("Group name (empty removes)", "分組名稱（留空即移除）") });
    const ok = await ctx.openDialog((close) => [h("h2", { class: "h2" }, t(`Group ${sel.size} accounts`, `將 ${sel.size} 個帳戶分組`)), grp, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close(true) }, t("Apply", "套用")))], { label: t("Group accounts", "帳戶分組") }).closed;
    if (!ok) return;
    const out = await api.post("/api/x/authenticator/bulk", { action: "group", ids: [...sel.chosen], group: grp.value });
    toast(t(`Grouped ${out.done}; skipped ${out.skipped.length}.`, `已分組 ${out.done} 個；跳過 ${out.skipped.length} 個。`));
    await load();
  }

  async function bulkDelete() {
    const names = view.accounts.filter((a) => sel.has(a.id)).map((a) => `${a.issuer ? `${a.issuer}: ` : ""}${a.label}`);
    const token = await askSuper(ctx, { action: "authenticator.bulk-delete", title: t(`Delete ${names.length} accounts`, `刪除 ${names.length} 個帳戶`), affects: [t(`Permanently deletes ${names.length} accounts and their secrets: ${names.slice(0, 5).join(", ")}${names.length > 5 ? "..." : ""}.`, `永久刪除 ${names.length} 個帳戶同佢哋嘅密碼：${names.slice(0, 5).join("、")}${names.length > 5 ? "..." : ""}。`), t("The codes cannot be recovered afterwards unless you saved the secrets elsewhere.", "之後除非你另外儲存咗密碼，否則無法恢復驗證碼。")] });
    if (!token) return toast(t("Cancelled. Nothing was deleted.", "已取消，冇刪除任何嘢。"));
    try {
      const out = await api.post("/api/x/authenticator/bulk", { action: "delete", ids: [...sel.chosen], token });
      toast(t(`Deleted ${out.done}; skipped ${out.skipped.length}.`, `已刪除 ${out.done} 個；跳過 ${out.skipped.length} 個。`));
      sel.clear();
      await load();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  async function showQr(a) {
    const token = await askSuper(ctx, { action: "authenticator.reveal", title: t("Show a secret as a QR code", "以二維碼顯示密碼"), affects: [t(`Shows the secret for ${a.label} on this screen so another device can scan it.`, `喺屏幕顯示 ${a.label} 嘅密碼，方便另一部裝置掃描。`)] });
    if (!token) return;
    try {
      const out = await api.post("/api/x/authenticator/reveal", { id: a.id, token });
      const qr = await api.post("/api/x/qr-pairing/qr", { text: out.uri }).catch(() => null);
      ctx.openDialog((close) => [h("h2", { class: "h2" }, a.label), qr ? h("div", { class: "au-qrwrap" }, qrSvg(qr, t("QR code for this account", "呢個帳戶嘅二維碼"))) : h("div", { class: "note warn" }, icon("info"), t("The QR drawing is not available. Use the secret below.", "二維碼用唔到，請用下面嘅密碼。")), h("div", { class: "mono" }, out.secret), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Hide", "收埋")))], { label: a.label });
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  function addTab() {
    const uri = h("input", { class: "field", "aria-label": t("otpauth address", "otpauth 地址"), placeholder: "otpauth://totp/..." });
    const issuer = h("input", { class: "field", "aria-label": t("Issuer", "發行者") });
    const name = h("input", { class: "field", "aria-label": t("Account name", "帳戶名稱") });
    const secret = h("input", { class: "field mono", type: "password", autocomplete: "off", "aria-label": t("Base32 secret", "Base32 密碼") });
    const alg = h("select", { class: "field", "aria-label": t("Algorithm", "演算法") }, ["SHA1", "SHA256", "SHA512"].map((a) => h("option", {}, a)));
    const digits = h("select", { class: "field", "aria-label": t("Digits", "位數") }, [6, 7, 8].map((d) => h("option", { value: String(d) }, String(d))));
    const period = h("input", { class: "field", type: "number", min: "1", max: "3600", value: "30", "aria-label": t("Period in seconds", "更新間隔（秒）") });
    const done = async (body) => {
      try {
        await api.post("/api/x/authenticator/accounts", body);
        toast(t("Account added.", "已新增帳戶。"));
        view.tab = "codes";
        await load();
      } catch (error) {
        toast(error.message, "bad");
      }
    };
    return h("div", { class: "au-pane", role: "tabpanel" },
      h("section", { class: "card" }, h("div", { class: "k" }, t("From an otpauth address", "用 otpauth 地址")), uri, h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => done({ uri: uri.value }) }, icon("add", "sm"), t("Add", "新增")))),
      h("section", { class: "card" }, h("div", { class: "k" }, t("By hand", "手動輸入")), h("div", { class: "grid2" }, h("label", {}, t("Issuer", "發行者"), issuer), h("label", {}, t("Account name", "帳戶名稱"), name), h("label", {}, t("Base32 secret", "Base32 密碼"), secret), h("label", {}, t("Algorithm", "演算法"), alg), h("label", {}, t("Digits", "位數"), digits), h("label", {}, t("Period (seconds)", "間隔（秒）"), period)),
        h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => done({ issuer: issuer.value, label: name.value, secret: secret.value, algorithm: alg.value, digits: Number(digits.value), period: Number(period.value) }) }, icon("add", "sm"), t("Add", "新增")))),
      h("div", { class: "note" }, icon("info"), t("No camera is used. To add from a QR code, open it in your other app and copy its otpauth address, or import a file in the next tab. In progress: decoding a QR code from an image or the clipboard is not built yet.", "冇用鏡頭。想由二維碼新增，請喺另一個程式複製 otpauth 地址，或者喺下一個分頁匯入檔案。進行中：由圖片或剪貼簿解碼二維碼仲未做好。")));
  }

  function transferTab() {
    const text = h("textarea", { class: "field au-text", "aria-label": t("Paste otpauth addresses, one per line", "貼上 otpauth 地址，每行一個"), placeholder: "otpauth://totp/...\notpauth://totp/..." });
    const file = h("input", { type: "file", accept: ".txt,.json,text/plain,application/json", "aria-label": t("Choose a file to import", "揀要匯入嘅檔案"), onChange: async (e) => { const f = e.target.files[0]; if (f) { if (f.size > 1024 * 1024) return toast(t("That file is too large.", "檔案太大。"), "bad"); text.value = await f.text(); } } });
    return h("div", { class: "au-pane", role: "tabpanel" },
      h("section", { class: "card" }, h("div", { class: "k" }, t("Import", "匯入")), file, text,
        h("div", { class: "actions" }, h("button", { class: "btn f", onClick: async () => {
          try {
            const out = await api.post("/api/x/authenticator/import-text", { text: text.value });
            toast(t(`Added ${out.added}; skipped ${out.skipped.length}${out.skipped[0] ? `: ${out.skipped[0].reason}` : ""}.`, `已新增 ${out.added} 個；跳過 ${out.skipped.length} 個${out.skipped[0] ? `：${out.skipped[0].reason}` : ""}。`));
            view.tab = "codes";
            await load();
          } catch (error) {
            toast(error.message, "bad");
          }
        } }, icon("upload", "sm"), t("Import", "匯入")))),
      h("section", { class: "card" }, h("div", { class: "k" }, t("Export", "匯出")),
        h("p", {}, t("An ordinary export lists your accounts but leaves every secret out, and says so inside the file.", "一般匯出列出帳戶，但唔包含任何密碼，檔案內亦會註明。")),
        h("div", { class: "actions" },
          h("button", { class: "btn t", onClick: async () => download(h, "authenticator-accounts.json", JSON.stringify(await api.get("/api/x/authenticator/export"), null, 2), "application/json") }, icon("download", "sm"), t("Export without secrets", "匯出（唔包含密碼）")),
          h("button", { class: "btn d", onClick: async () => {
            const token = await askSuper(ctx, { action: "authenticator.export-secrets", title: t("Export accounts with secrets", "匯出帳戶同密碼"), affects: [t("Writes every secret to a file in readable form. Anyone with the file can make your codes.", "將所有密碼以可讀形式寫入檔案。任何有檔案嘅人都可以產生你嘅驗證碼。")] });
            if (!token) return toast(t("Cancelled. Nothing was exported.", "已取消，冇匯出任何嘢。"));
            try {
              download(h, "authenticator-secrets.json", JSON.stringify(await api.get(`/api/x/authenticator/export?secrets=1&token=${encodeURIComponent(token)}`), null, 2), "application/json");
            } catch (error) {
              toast(error.message, "bad");
            }
          } }, icon("key", "sm"), t("Export with secrets", "匯出（包含密碼）")))));
  }

  await load();
  return () => clearInterval(timer);
}

export default {
  id: "authenticator",
  screens: [{ id: "authenticator", group, icon: "verified_user", label, render }],
  commands: [{ id: "authenticator.open", icon: "verified_user", label: { en: "Open the authenticator", yue: "開啟驗證器" }, keywords: "totp 2fa codes otp", run: (ctx) => ctx.navigate("authenticator") }],
};
