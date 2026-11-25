// Cloud screen: AiCloud and WebDAV behind a typed gate and a red exposure
// warning, voice assistants and IFTTT, the speed test setting, and read-only
// views of the remote app link, ASUS feedback and the agreements.
// Agreements are never accepted here.

const label = { en: "Cloud and ASUS account", yue: "雲端同 ASUS 帳戶" };
const lede = { en: "Reaching your files from outside, voice control, and what the router tells ASUS.", yue: "喺屋企以外都攞到檔案、語音控制，同路由器會同 ASUS 講啲乜。" };
export const CONFIRM_WORD = "INTERNET";

// One line the person can act on, from the facts the server read.
export function exposureSummary(exposed) {
  const on = [exposed.aicloud && "AiCloud", exposed.webdav && "WebDAV"].filter(Boolean);
  return { open: on.length > 0, names: on };
}

// Feedback keys: sending is only claimed when a key says so.
export const feedbackWord = (fb) => (fb.keys.length === 0 ? "none" : fb.sending ? "sending" : "idle");

function gatedRow(ctx, entry, redraw) {
  const { h, icon, t, tt } = ctx;
  const on = () => (ctx.dock.has(entry.id) ? ctx.dock.value(entry.id) : entry.value) === entry.values.on;
  const ask = async () => {
    const dialog = ctx.openDialog((close) => {
      const typed = h("input", { class: "field", autocomplete: "off", spellcheck: "false", "aria-label": t("Type the word to confirm", "輸入個字確認") });
      const go = h("button", { class: "btn d", disabled: true, onClick: () => close(true) }, icon("cloud_upload", "sm"), t("Turn it on", "開啟"));
      typed.addEventListener("input", () => { go.disabled = typed.value.trim() !== CONFIRM_WORD; });
      return [
        h("h2", { class: "h2" }, t(`Turn on ${tt(entry.label)}?`, `開啟「${tt(entry.label)}」？`)),
        h("div", { class: "cl-warning" }, icon("warning"), t("This lets people on the internet try to reach your files. Use a long, unique password, keep the router updated, and turn it off again when you do not need it.", "呢個設定會等互聯網上嘅人試圖去到你嘅檔案。請用又長又獨一無二嘅密碼，保持路由器更新，唔使嘅時候就關返。")),
        h("label", { class: "t2" }, t(`Type ${CONFIRM_WORD} to go on`, `輸入 ${CONFIRM_WORD} 繼續`)), typed,
        h("div", { class: "chips" }, h("button", { class: "btn t", onClick: () => close(false) }, t("Keep it off", "保持關閉")), go),
      ];
    }, { label: t("Confirm exposing files", "確認公開檔案") });
    return (await dialog.closed) === true;
  };
  const sw = h("button", { class: "sw", role: "switch", "aria-checked": String(on()), "aria-label": tt(entry.label), disabled: !ctx.state.canWrite || Boolean(entry.disabled), async onClick() {
    if (on()) ctx.dock.setEntry(entry, entry.values.off);
    else if (await ask()) ctx.dock.setEntry(entry, entry.values.on);
    redraw();
  } }, h("i"));
  return h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, tt(entry.label), " ", on() ? h("span", { class: "tag bad" }, icon("public", "sm"), t("Open to the internet", "對互聯網開放")) : h("span", { class: "tag good" }, t("Off", "關閉"))),
    h("div", { class: "t2" }, tt(entry.help)), entry.disabled ? h("div", { class: "t2" }, tt(entry.disabled)) : null), sw);
}

function statusRows(ctx, title, intro, keys, whenEmpty) {
  const { h, icon, t } = ctx;
  return h("section", { class: "card tone rise" }, h("h2", { class: "h2" }, title), h("div", { class: "t2" }, intro),
    keys.length
      ? keys.map((k) => h("div", { class: "row" }, icon(k.set ? "radio_button_checked" : "radio_button_unchecked"), h("div", { class: "grow t1 cl-mono" }, k.key), h("span", { class: `tag ${k.set ? "warn" : ""}` }, k.set ? t("Set", "已設定") : t("Empty", "空白"))))
      : h("div", { class: "t2" }, whenEmpty));
}

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/cloud");
  const holder = h("div", { class: "cl-stack" });
  page.append(holder);
  const draw = () => {
    ctx.clear(holder);
    const groups = ctx.controls.settingGroups(data.entries);
    const cloud = groups.find((g) => g.id === "aicloud");
    const gated = cloud?.entries.filter((x) => x.meta?.exposure) ?? [];
    const plain = cloud?.entries.filter((x) => !x.meta?.exposure) ?? [];
    const ex = exposureSummary(data.exposed);
    holder.append(
      h("section", { class: `card rise cl-exposure ${ex.open ? "bad" : "tone"}` },
        h("div", { class: "cl-ring", "aria-hidden": "true" }, icon(ex.open ? "cloud_upload" : "cloud_off", "lg")),
        h("h2", { class: "h2" }, ex.open ? t(`${ex.names.join(" and ")} can be reached from the internet`, `${ex.names.join(" 同 ")} 可以由互聯網去到`) : t("Your files are not reachable from the internet", "你嘅檔案唔可以由互聯網去到")),
        h("div", { class: "t1" }, ex.open ? t("Turn these off unless you are using them today. Use the HTTPS port and a strong password.", "今日冇用就關咗佢。請用 HTTPS 端口同強密碼。") : t("AiCloud and WebDAV are off, which is the safe default.", "AiCloud 同 WebDAV 都關咗，呢個係安全嘅預設。")),
        ...gated.map((x) => gatedRow(ctx, x, draw))),
      plain.length ? ctx.controls.groupCard(cloud.label, plain) : null,
      ...groups.filter((g) => g.id !== "aicloud" && g.id !== "consent").map((g) => ctx.controls.groupCard(g.label, g.entries)),
      statusRows(ctx, t("Remote app link", "遠端程式連結"), t("Whether this router is linked to the ASUS router app. Only whether each setting is filled in is shown, never its value.", "呢部路由器有冇連結 ASUS 路由器程式。只顯示每個設定有冇填，唔會顯示內容。"), data.binding.keys, t("This router has no remote app link settings.", "呢部路由器冇遠端程式連結設定。")),
      h("section", { class: "card tone rise" }, h("h2", { class: "h2" }, t("Feedback to ASUS", "向 ASUS 回饋")),
        h("div", { class: "t1" }, { none: t("This router has no feedback settings.", "呢部路由器冇回饋設定。"), sending: t("Feedback settings are filled in.", "回饋設定已填寫。"), idle: t("Feedback is not set up.", "未設定回饋。") }[feedbackWord(data.feedback)]),
        h("div", { class: "t2" }, t("To stop sending feedback, switch it off on the router's own Feedback page. This app only reads it and cannot send anything for you.", "想停止傳送回饋，請喺路由器自己嘅「回饋」頁面關閉。呢個程式只讀，唔會替你傳送任何嘢。")),
        data.feedback.keys.map((k) => h("div", { class: "row" }, h("div", { class: "grow t1 cl-mono" }, k.key), h("span", { class: `tag ${k.set ? "warn" : ""}` }, k.set ? t("Set", "已設定") : t("Empty", "空白"))))),
      h("section", { class: "card tone rise" }, h("h2", { class: "h2" }, t("Agreements", "協議")),
        h("div", { class: "t2" }, t("Agreements are accepted by a person on the router's own page. This app only shows the result and never accepts one for you.", "協議要由人喺路由器自己嘅頁面接受。呢個程式只顯示結果，永遠唔會替你接受。")),
        h("div", { class: "row" }, icon(data.agreements.asus ? "task_alt" : "radio_button_unchecked"), h("div", { class: "grow t1" }, t("ASUS terms of use", "ASUS 使用條款")), h("span", { class: "tag" }, data.agreements.asus ? t("Accepted", "已接受") : t("Not accepted", "未接受"))),
        h("div", { class: "row" }, icon(data.agreements.trendMicro ? "task_alt" : "radio_button_unchecked"), h("div", { class: "grow t1" }, t("Trend Micro terms of use", "Trend Micro 使用條款")), h("span", { class: "tag" }, data.agreements.trendMicro ? t("Accepted", "已接受") : t("Not accepted", "未接受")))));
  };
  draw();
  return ctx.bus.on("changed", async () => { data = await api.get("/api/domain/cloud"); draw(); });
}

export default {
  id: "cloud",
  screens: [{ id: "cloud", group: { en: "Router", yue: "路由器" }, icon: "cloud", label, render: screen }],
  settings: [{ id: "cloud", icon: "cloud", label, async render(ctx) { const d = await ctx.api.get("/api/domain/cloud"); return ctx.controls.settingGroups(d.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [{ id: "cloud.open", icon: "cloud", label: { en: "Open cloud and ASUS account", yue: "開雲端同 ASUS 帳戶" }, keywords: "aicloud webdav alexa ifttt feedback eula 雲端 回饋", run: (ctx) => ctx.navigate("cloud") }],
};
