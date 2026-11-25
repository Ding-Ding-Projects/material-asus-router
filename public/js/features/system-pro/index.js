// The System tools screen: live temperature gauges, every access, time, log,
// light and button setting as a rich control, SSH keys and wake-on-LAN devices.
import { createUi } from "./ui.js";

const label = { en: "System tools", yue: "系統工具" };
const lede = { en: "Access, SSH keys, time, lights, restarts and temperatures.", yue: "存取、SSH 金鑰、時間、燈號、重啟同溫度。" };

// A semicircle-free, plain bar gauge that works in both themes and without colour alone.
export function gaugeState(celsius, warnAt, maxAt) {
  if (celsius === null || celsius === undefined) return { share: 0, tone: "", word: "unavailable" };
  const share = Math.max(0, Math.min(1, celsius / maxAt));
  return { share, tone: celsius >= maxAt * 0.95 ? "bad" : celsius >= warnAt ? "warn" : "", word: celsius >= maxAt * 0.95 ? "hot" : celsius >= warnAt ? "warm" : "normal" };
}

function gaugeCard(ctx, ui, root) {
  const { api, h, t, tt, icon } = ctx;
  const body = h("div", { class: "grid" });
  const stamp = h("div", { class: "t2" }, "");
  const wording = { normal: t("Normal", "正常"), warm: t("Warm", "偏暖"), hot: t("Hot", "好熱"), unavailable: t("Not reported by this router", "呢部路由器冇提供") };
  async function paint() {
    try {
      const data = await api.get("/api/x/system-pro/sensors");
      body.replaceChildren(...data.gauges.map((g) => {
        const s = gaugeState(g.celsius, g.warnAt, g.maxAt);
        const bar = h("i", {});
        bar.style.setProperty("--w", `${Math.round(s.share * 100)}%`);
        return h("div", { class: "gauge" },
          h("div", { class: "k" }, tt(g.label)),
          h("div", { class: "big" }, g.celsius === null ? "–" : Math.round(g.celsius), h("small", {}, g.celsius === null ? "" : "°C")),
          h("div", { class: `meter ${s.tone}`, role: "meter", "aria-label": tt(g.label), "aria-valuemin": "0", "aria-valuemax": String(g.maxAt), "aria-valuenow": String(g.celsius ?? 0), "aria-valuetext": `${g.celsius ?? "?"} °C, ${s.word}` }, bar),
          h("div", { class: "t2" }, wording[s.word]));
      }));
      stamp.textContent = t(`Updated ${new Date(data.readAt).toLocaleTimeString()}`, `更新於 ${new Date(data.readAt).toLocaleTimeString()}`);
    } catch (error) {
      stamp.textContent = error.message;
    }
  }
  root.append(ui.card(ui.headRow(t("Temperatures", "溫度"), h("button", { class: "btn t sm", onClick: paint }, icon("refresh", "sm"), t("Refresh", "重新整理"))), body, stamp));
  paint();
  const timer = setInterval(() => !document.hidden && paint(), 5000);
  return () => clearInterval(timer);
}

function keysCard(ctx, ui, data, refresh) {
  const { api, h, t, icon, confirmDialog } = ctx;
  const add = () => ui.form({
    title: t("Allow an SSH key", "容許一條 SSH 金鑰"),
    intro: t("Paste one public key, the line that starts with ssh-ed25519 or ssh-rsa. Never paste a private key.", "貼上一條公開金鑰，即係以 ssh-ed25519 或 ssh-rsa 開頭嗰行。千祈唔好貼私密金鑰。"),
    fields: [{ name: "key", label: { en: "Public key", yue: "公開金鑰" }, type: "textarea", rows: 4 }],
    submitLabel: t("Preview", "預覽"),
    async submit(values) {
      const preview = await api.post("/api/x/system-pro/ssh-keys", { key: values.key });
      setTimeout(async () => ((await ui.review(preview, { title: t("Allow this SSH key", "容許呢條 SSH 金鑰") }).closed) && refresh()), 0);
    },
  });
  const remove = async (key) => {
    if (!(await confirmDialog({ title: t("Remove this SSH key?", "移除呢條 SSH 金鑰？"), body: t("Whoever holds the matching private key can no longer sign in. If it is the key this app uses, the safety net restores it.", "持有對應私密金鑰嘅人將唔可以再登入。如果係呢個程式用緊嘅金鑰，安全機制會還原。"), confirm: t("Preview", "預覽"), danger: true }))) return;
    if (await ui.plan(() => api.del(`/api/x/system-pro/ssh-keys/${key.index}`))) refresh();
  };
  return ui.card(
    ui.headRow(t("SSH keys", "SSH 金鑰"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: add }, icon("add", "sm"), t("Allow a key", "容許金鑰")) : null),
    h("div", { class: "t2" }, t("Keys that may sign in to the router over SSH, shown by fingerprint.", "可以用 SSH 登入路由器嘅金鑰，以指紋顯示。")),
    data.sshKeys.length
      ? data.sshKeys.map((k) => h("div", { class: "row" }, icon("key"), h("div", { class: "grow" }, h("div", { class: "t1" }, k.comment || t("(no comment)", "（冇備註）"), " ", h("span", { class: "tag" }, k.type)), h("div", { class: "t2 mono" }, k.fingerprint)),
        ctx.state.canWrite ? h("button", { class: "btn t icon", "aria-label": t("Remove this key", "移除呢條金鑰"), onClick: () => remove(k) }, icon("delete", "sm")) : null))
      : ui.empty(t("No SSH keys are allowed. Sign-in uses the router password.", "未有容許任何 SSH 金鑰，登入靠路由器密碼。")));
}

async function wolCard(ctx, ui, data, refresh) {
  const { api, h, t, icon, toast } = ctx;
  const devices = await api.get("/api/domain/devices").then((d) => d.devices ?? []).catch(() => []);
  const add = () => ui.form({
    title: t("Add a device to wake", "加入要喚醒嘅裝置"),
    fields: [
      { name: "pick", label: { en: "Known device", yue: "已知裝置" }, type: "select", options: [["", { en: "Choose or type a MAC below", yue: "揀一部，或者喺下面輸入 MAC" }], ...devices.map((d) => [d.mac, { en: `${d.name} (${d.mac})`, yue: `${d.name}（${d.mac}）` }])], value: "" },
      { name: "name", label: { en: "Name", yue: "名稱" }, maxlength: 32 },
      { name: "mac", label: { en: "MAC address", yue: "MAC 地址" }, placeholder: "AA:BB:CC:DD:EE:FF", maxlength: 17 },
    ],
    submitLabel: t("Preview", "預覽"),
    async submit(values) {
      const known = devices.find((d) => d.mac === values.pick);
      const body = { name: values.name || known?.name || "", mac: values.mac || values.pick };
      const preview = await api.post("/api/x/system-pro/wol", body);
      setTimeout(async () => ((await ui.review(preview, { title: t("Add to the wake list", "加入喚醒清單") }).closed) && refresh()), 0);
    },
  });
  const wake = async (row) => {
    try {
      await api.post("/api/actions/wake", { mac: row.mac });
      toast(t(`Wake signal sent to ${row.name}.`, `已向 ${row.name} 發出喚醒訊號。`));
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  return ui.card(
    ui.headRow(t("Wake-on-LAN devices", "網絡喚醒裝置"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: add }, icon("add", "sm"), t("Add a device", "加入裝置")) : null),
    data.wol.length
      ? data.wol.map((r) => h("div", { class: "row" }, icon("power_settings_new"), h("div", { class: "grow" }, h("div", { class: "t1" }, r.name), h("div", { class: "t2 mono" }, r.mac)),
        h("button", { class: "btn t sm", disabled: !ctx.state.canWrite, onClick: () => wake(r) }, icon("bolt", "sm"), t("Wake", "喚醒")),
        ctx.state.canWrite ? h("button", { class: "btn t icon", "aria-label": t("Remove from the list", "由清單移除"), onClick: async () => ((await ui.plan(() => api.del(`/api/x/system-pro/wol/${encodeURIComponent(r.mac)}`))) && refresh()) }, icon("delete", "sm")) : null))
      : ui.empty(t("No devices on the wake list yet.", "喚醒清單暫時未有裝置。")));
}

async function draw(ctx, root, cleanups) {
  const ui = createUi(ctx);
  const { api, h, t } = ctx;
  const data = await api.get("/api/domain/system-pro");
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  const refresh = () => draw(ctx, root, cleanups);
  cleanups.push(gaugeCard(ctx, ui, page));
  for (const g of ctx.controls.settingGroups(data.entries)) page.append(ctx.controls.groupCard(g.label, g.entries));
  if (data.related.length) page.append(ctx.controls.groupCard({ en: "Also on the System screen", yue: "「系統」畫面都有" }, data.related));
  page.append(keysCard(ctx, ui, data, refresh), await wolCard(ctx, ui, data, refresh));
  if (!data.merlin) page.append(h("div", { class: "note" }, ctx.icon("info"), h("div", {}, t("Some settings need Asuswrt-Merlin firmware and are shown switched off with the reason.", "部分設定要用 Asuswrt-Merlin 韌體，會顯示為停用，並寫明原因。"))));
}

export default {
  id: "system-pro",
  screens: [
    {
      id: "system-pro",
      group: { en: "Router", yue: "路由器" },
      icon: "settings_applications",
      label,
      async render(ctx) {
        const cleanups = [];
        await draw(ctx, ctx.root, cleanups);
        const off = ctx.bus.on("changed", () => draw(ctx, ctx.root, cleanups));
        return () => {
          off();
          cleanups.forEach((fn) => fn());
        };
      },
    },
  ],
  settings: [
    {
      id: "system-pro",
      icon: "settings_applications",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/system-pro");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],
  commands: [
    { id: "system-pro.open", icon: "settings_applications", label: { en: "Open System tools", yue: "開啟系統工具" }, keywords: "ssh keys time zone ntp telnet led temperature reboot wake", run: (ctx) => ctx.navigate("system-pro") },
    { id: "system-pro.temperatures", icon: "device_thermostat", label: { en: "Show router temperatures", yue: "睇路由器溫度" }, keywords: "cpu radio heat gauge", run: (ctx) => ctx.navigate("system-pro") },
  ],
};
