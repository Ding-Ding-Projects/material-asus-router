// Routers: save the router in use by name, as Main or Testing, and switch between saved routers.
// A Testing router is marked in the top bar the whole time it is in use, so a change meant for
// the test router is never mistaken for one on the main router.

const label = { en: "Routers", yue: "路由器" };
export const ROLE = { main: { en: "Main", yue: "主路由器" }, testing: { en: "Testing", yue: "測試用" } };

async function screen(ctx) {
  const { api, h, icon, t, tt, clear } = ctx;
  const page = ctx.page(label, { en: "Keep more than one router, for example the main one and a Testing router, and switch between them. Each keeps its own sign-in and approved host key.", yue: "可以儲存多過一部路由器，例如主路由器同測試用路由器，再喺佢哋之間切換。每部都有自己嘅登入資料同已核准嘅主機金鑰。" });
  ctx.root.append(page);
  const list = h("section", { class: "card", "aria-live": "polite" });
  const save = h("section", { class: "card tone" });
  const result = h("div", { class: "routers-result", "aria-live": "polite" });
  page.append(result, save, list);
  const showResult = (ok, title, text) => clear(result).append(h("section", { class: `card ${ok ? "good" : "bad"}`, role: ok ? "status" : "alert" }, h("b", {}, title), h("p", {}, text)));
  // A switch reloads the app; the result is kept for the one reload that follows.
  try {
    const done = sessionStorage.getItem("mar.routers.switched");
    if (done) {
      sessionStorage.removeItem("mar.routers.switched");
      const r = JSON.parse(done);
      showResult(true, t(`Now using ${r.name}`, `而家用緊 ${r.name}`), r.role === "testing"
        ? t(`The app signed in to ${r.name} with its own saved sign-in and approved host key. The Testing badge shows while it is in use.`, `程式用 ${r.name} 自己儲存咗嘅登入資料同已核准嘅主機金鑰登入咗。用緊佢嗰陣會顯示測試用標記。`)
        : t(`The app signed in to ${r.name} with its own saved sign-in and approved host key. The Testing badge is gone.`, `程式用 ${r.name} 自己儲存咗嘅登入資料同已核准嘅主機金鑰登入咗。測試用標記已經冇咗。`));
    }
  } catch {}
  const form = { name: "", role: "main", busy: false };

  async function load() {
    let routers = [];
    let current = null;
    try {
      [{ routers }, current] = await Promise.all([api.get("/api/routers"), api.get("/api/router")]);
    } catch (error) {
      clear(list).append(h("p", { class: "bad", role: "alert" }, error.message));
      return;
    }
    clear(save).append(
      h("div", { class: "k" }, t("The router in use", "而家用緊嘅路由器")),
      h("p", { class: "t1" }, `${current.username}@${current.host}:${current.port}`, current.active ? ` · ${current.active.name} (${tt(ROLE[current.active.role])})` : ""),
      h("label", { class: "lbl" }, t("Name", "名稱"), h("input", { class: "field", maxlength: "40", value: form.name || current.active?.name || "", placeholder: t("Living room", "客廳"), onInput: (e) => (form.name = e.target.value) })),
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("What this router is for", "呢部路由器用嚟做咩") }, Object.entries(ROLE).map(([id, text]) =>
        h("button", { type: "button", role: "radio", "aria-checked": String(form.role === id), class: form.role === id ? "on" : "", onClick: () => { form.role = id; load(); } }, tt(text)))),
      h("div", { class: "actions" }, h("button", { class: "btn f", disabled: form.busy, onClick: async () => {
        form.busy = true;
        try {
          await api.post("/api/routers", { name: form.name || current.active?.name || "", role: form.role });
          ctx.toast(t("Router saved.", "已儲存路由器。"));
          form.name = "";
        } catch (error) { ctx.toast(error.message, "bad"); }
        form.busy = false;
        load();
      } }, icon("save", "sm"), current.active ? t("Update this router", "更新呢部路由器") : t("Save this router", "儲存呢部路由器"))));
    clear(list).append(h("div", { class: "k" }, t("Saved routers", "已儲存嘅路由器")));
    if (!routers.length) return list.append(h("p", { class: "t1" }, t("No router saved yet", "未儲存任何路由器")), h("p", { class: "t2" }, t("Connect to a router and save it here. Keep more than one, for example the main one and a Testing router, and switch between them.", "連接一部路由器再喺度儲存。可以儲存多過一部，例如主路由器同測試用路由器，再喺佢哋之間切換。")));
    list.append(h("ul", { class: "routers-list" }, routers.map((r) => h("li", { class: `routers-row ${r.role}` },
      icon(r.role === "testing" ? "science" : "router"),
      h("div", { class: "grow" },
        h("div", { class: "t1" }, r.name, " ", h("span", { class: `chip ${r.role}` }, tt(ROLE[r.role]))),
        h("div", { class: "t2 mono" }, `${r.username}@${r.host}:${r.port} · ${r.authType === "key" ? t("key", "金鑰") : t("password", "密碼")}`)),
      r.active ? h("span", { class: "chip on" }, icon("check", "sm"), t("In use", "使用緊"))
        : h("button", { class: "btn o sm", onClick: async () => {
            try {
              await api.post(`/api/routers/${encodeURIComponent(r.id)}/use`, {});
              try { sessionStorage.setItem("mar.routers.switched", JSON.stringify({ name: r.name, role: r.role })); } catch {}
              location.reload();
            } catch (error) {
              showResult(false, t("Could not switch routers", "切換唔到路由器"), `${t("Nothing was left half-applied. The router is as it was before.", "冇做咗一半嘅改動，路由器同之前一樣。")} ${error.message}`);
            }
          } }, icon("swap_horiz", "sm"), t("Use this router", "用呢部路由器")),
      r.active ? null : h("button", { class: "btn t icon", "aria-label": `${t("Remove", "移除")} ${r.name}`, title: t("Remove", "移除"), onClick: async () => {
        if (!(await ctx.confirmDialog({ title: t(`Remove ${r.name}?`, `移除 ${r.name}？`), body: t("The app forgets this router and its stored password. The router itself is not changed.", "程式會忘記呢部路由器同佢嘅密碼，路由器本身唔會改。"), confirm: t("Remove", "移除"), danger: true }))) return;
        try { await api.del(`/api/routers/${encodeURIComponent(r.id)}`); load(); } catch (error) { ctx.toast(error.message, "bad"); }
      } }, icon("delete", "sm"))))));
  }
  await load();
}

// The top-bar badge: visible only while a Testing router is in use.
function badge(ctx) {
  const { api, h, icon, t } = ctx;
  const el = h("a", { class: "routers-badge", href: "#/routers", hidden: true, role: "status" });
  document.body.append(el);
  api.get("/api/router").then((info) => {
    if (info?.active?.role !== "testing") return;
    el.replaceChildren(icon("science", "sm"), h("span", {}, t(`Testing router: ${info.active.name}`, `測試用路由器：${info.active.name}`)));
    el.hidden = false;
  }).catch(() => {});
  return () => el.remove();
}

export default {
  id: "routers",
  screens: [{ id: "routers", group: { en: "Router", yue: "路由器" }, icon: "lan", label, render: screen }],
  overlays: [{ id: "routers.badge", mount: badge }],
  commands: [{ id: "routers.open", icon: "swap_horiz", label: { en: "Switch router (Main or Testing)", yue: "切換路由器（主路由器或測試用）" }, keywords: "router switch testing test main routers 路由器 切換 測試", run: (ctx) => ctx.navigate("routers") }],
};
