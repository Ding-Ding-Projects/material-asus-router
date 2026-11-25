// The extension manager. Lists the extensions (built-in ones today), shows
// exactly what each asks for, and runs one only after the person has allowed
// every permission it asks for. What you allow is remembered with the version
// of the permissions you saw, so a change in what an extension asks for asks
// you again. The router password and SSH credentials are never offered to an
// extension at all.
const KEY = "mar.nav.ext.consent";
const kv = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const stamp = (ext) => `${ext.version}|${[...ext.permissions].sort().join(",")}`;

async function manager(ctx) {
  const { h, icon, t, tt } = ctx;
  const data = await ctx.api.get("/api/x/extension-support/list");
  const consent = kv.get(KEY, {});
  const input = h("input", { type: "search", class: "field", "data-search-id": "extensions", "aria-label": t("Search extensions", "搜尋擴充功能"), placeholder: t("Search extensions", "搜尋擴充功能") });
  const list = h("div", { class: "grid2" });
  const results = new Map();
  const allowedOf = (ext) => (consent[ext.id]?.stamp === stamp(ext) ? consent[ext.id].allowed : []);
  const draw = () => {
    const rx = ctx.state && globalThis.marNav?.regex?.stateOf(input);
    const m = rx?.mode === "regex" ? globalThis.marNav.regex.matcherFor(input) : null;
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const test = m ? m.test : (s) => words.every((w) => s.toLowerCase().includes(w));
    const shown = data.extensions.filter((e) => test(`${e.name.en}
${e.name.yue}
${e.description.en}
${e.description.yue}
${e.id}
${e.permissions.join("\n")}`));
    list.replaceChildren(...shown.map((ext) => {
      const allowed = allowedOf(ext);
      const all = ext.permissions.every((p) => allowed.includes(p));
      const out = results.get(ext.id);
      return h("section", { class: "card rise" },
        h("div", { class: "row" }, icon("extension", "sm"), h("div", { class: "grow" }, h("h2", { class: "h2" }, tt(ext.name)), h("div", { class: "t2" }, `v${ext.version}${ext.builtin ? ` · ${t("built in", "內置")}` : ""}`))),
        h("p", { class: "muted" }, tt(ext.description)),
        h("div", { class: "k" }, t("It asks to", "佢要求可以")),
        ext.permissionLabels.length ? ext.permissionLabels.map((p) => h("label", { class: "row" }, h("input", { type: "checkbox", checked: allowed.includes(p.id), "aria-label": tt(p.label), onChange: (e) => { const set = new Set(allowedOf(ext)); if (e.target.checked) set.add(p.id); else set.delete(p.id); if (set.size) consent[ext.id] = { stamp: stamp(ext), allowed: [...set] }; else delete consent[ext.id]; kv.set(KEY, consent); draw(); } }), h("span", { class: "grow" }, tt(p.label)), h("code", { class: "t2" }, p.id))) : h("div", { class: "t2" }, t("Nothing. It reads no router data.", "冇。佢唔讀取任何路由器資料。")),
        h("div", { class: "t2" }, t("It can never see the router password or the SSH credentials.", "佢永遠睇唔到路由器密碼或者 SSH 憑證。")),
        h("div", { class: "actions" }, h("button", { class: "btn f sm", disabled: !all || !ctx.state.canWrite, onClick: async () => {
          try { results.set(ext.id, await ctx.api.post("/api/x/extension-support/run", { id: ext.id, allowed: allowedOf(ext) })); } catch (e) { results.set(ext.id, { ok: false, error: e.message }); }
          draw();
        } }, icon("play_arrow", "sm"), all ? t("Run", "執行") : t("Allow first", "先允許"))),
        out ? h("pre", { class: "out" }, out.ok ? JSON.stringify(out.result, null, 2) : out.error) : null);
    }));
    if (!shown.length) list.append(h("div", { class: "empty" }, icon("search_off", "lg"), t("No extension matches.", "冇擴充功能配對。")));
  };
  input.addEventListener("input", draw);
  draw();
  ctx.root.append(ctx.page({ en: "Extensions", yue: "擴充功能" }, { en: "Small programs that add features. Each one lists what it may read, and runs only after you allow it. An extension runs as a separate process with a time and size limit.", yue: "加功能嘅小程式。每個都列明佢可以讀取乜嘢，你允許之後先會執行。擴充功能係獨立程序，有時間同大小限制。" },
    h("section", { class: "card" }, input, h("div", { class: "t2" }, t(`Protocol version ${data.api}. Limit ${data.limits.timeoutMs} ms and ${data.limits.maxBytes} bytes per run.`, `協定版本 ${data.api}。每次執行上限 ${data.limits.timeoutMs} 毫秒同 ${data.limits.maxBytes} 位元組。`))), list));
}

export default {
  id: "extension-support",
  screens: [{ id: "extensions", group: { en: "Router", yue: "路由器" }, icon: "extension", label: { en: "Extensions", yue: "擴充功能" }, render: manager }],
  commands: [{ id: "extension-support.open", icon: "extension", label: { en: "Open the extension manager", yue: "打開擴充功能管理" }, keywords: "plugins add-ons permissions", run: (ctx) => ctx.navigate("extensions") }],
};
