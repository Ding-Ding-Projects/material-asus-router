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
  page.append(save, list);
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
    if (!routers.length) return list.append(h("p", { class: "t2" }, t("No router is saved yet. Save the one in use above.", "未儲存任何路由器。喺上面儲存而家用緊嗰部。")));
    list.append(h("ul", { class: "routers-list" }, routers.map((r) => h("li", { class: `routers-row ${r.role}` },
      icon(r.role === "testing" ? "science" : "router"),
      h("div", { class: "grow" },
        h("div", { class: "t1" }, r.name, " ", h("span", { class: `chip ${r.role}` }, tt(ROLE[r.role]))),
        h("div", { class: "t2 mono" }, `${r.username}@${r.host}:${r.port} · ${r.authType === "key" ? t("key", "金鑰") : t("password", "密碼")}`)),
      r.active ? h("span", { class: "chip on" }, icon("check", "sm"), t("In use", "使用緊"))
        : h("button", { class: "btn o sm", onClick: async () => {
            try {
              await api.post(`/api/routers/${encodeURIComponent(r.id)}/use`, {});
              ctx.toast(t(`Switched to ${r.name}.`, `已切換到 ${r.name}。`));
              location.reload();
            } catch (error) { ctx.toast(error.message, "bad"); }
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
