// Web access screen: whether the router's page is open to the internet (a red,
// typed-confirm gate), the certificate and when it expires, the allowed
// address list, automatic sign-out and Let's Encrypt.

const label = { en: "Web access", yue: "網頁存取" };
const lede = { en: "Who can open the router's own page, from where, and how it proves who it is.", yue: "邊個可以喺邊度開路由器自己嘅頁面，同埋佢點樣證明自己。" };
export const CONFIRM_WORD = "INTERNET";

const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const ADDRESS = new RegExp(`^${OCTET}(\\.${OCTET}){3}(/(\\d|[12]\\d|3[0-2]))?$`);

// The same rule the server uses: an address, or a network of /8 or smaller.
export function allowedClient(item) {
  if (!ADDRESS.test(item)) return false;
  return (item.includes("/") ? Number(item.split("/")[1]) : 32) >= 8;
}
export const splitClients = (value) => String(value ?? "").split("<").filter(Boolean);

// How the certificate meter looks: share of a 90 day certificate left, and a word for it.
export function certificateState(cert) {
  if (!cert?.found) return { share: 0, tone: "", word: "unknown" };
  const share = Math.max(0, Math.min(1, cert.daysLeft / 90));
  return { share, tone: cert.tone === "fine" ? "" : cert.tone === "soon" ? "warn" : "bad", word: cert.tone };
}

function clientListControl(entry, current, commit, locked, ctx) {
  const { h, icon, t, tt } = ctx;
  const holder = h("div", { class: "chips" });
  const note = h("div", { class: "t2", role: "status" });
  const write = (list) => { commit(list.length ? `<${list.join("<")}` : ""); draw(); };
  const add = (raw) => {
    const value = raw.trim();
    if (!value) return;
    if (!allowedClient(value)) return void (note.textContent = t("Write an address like 198.51.100.20, or a network like 198.51.100.0/24 (not wider than /8).", "請寫地址，例如 198.51.100.20，或者網絡，例如 198.51.100.0/24（唔可以闊過 /8）。"));
    if (splitClients(current()).includes(value)) return void (note.textContent = t("That one is already on the list.", "呢個已經喺名單入面。"));
    if (splitClients(current()).length >= (entry.maxItems ?? 16)) return void (note.textContent = t("The list is full.", "名單滿咗。"));
    note.textContent = "";
    write([...splitClients(current()), value]);
  };
  const input = h("input", { class: "field", autocomplete: "off", spellcheck: "false", maxlength: "18", disabled: locked, placeholder: "198.51.100.20", "aria-label": tt(entry.label), onKeydown(e) { if (e.key === "Enter") { e.preventDefault(); add(e.target.value); e.target.value = ""; } } });
  const draw = () => holder.replaceChildren(...splitClients(current()).map((item) => h("span", { class: "chip on" }, item,
    locked ? null : h("button", { class: "x", type: "button", "aria-label": `${t("Remove", "移除")} ${item}`, onClick: () => write(splitClients(current()).filter((x) => x !== item)) }, icon("close", "sm")))));
  draw();
  return { el: h("div", { class: "chiplist" }, holder, h("div", { class: "ctl" }, input, h("button", { class: "btn t sm", type: "button", disabled: locked, onClick() { add(input.value); input.value = ""; } }, icon("add", "sm"), t("Add", "加入"))), note), sync: draw };
}

// Opening the page to the internet needs a typed word, not just a tap.
function exposureCard(ctx, data, redraw) {
  const { h, icon, t } = ctx;
  const entry = data.related.find((x) => x.id === "sys.remoteweb");
  const open = () => (entry ? (ctx.dock.has(entry.id) ? ctx.dock.value(entry.id) : entry.value) === "1" : data.internet.open);
  const ask = async () => {
    const dialog = ctx.openDialog((close) => {
      const typed = h("input", { class: "field", autocomplete: "off", spellcheck: "false", "aria-label": t("Type the word to confirm", "輸入個字確認") });
      const go = h("button", { class: "btn d", disabled: true, onClick: () => close(true) }, icon("public", "sm"), t("Open it to the internet", "對互聯網開放"));
      typed.addEventListener("input", () => { go.disabled = typed.value.trim() !== CONFIRM_WORD; });
      return [
        h("h2", { class: "h2" }, t("Open the router page to the internet?", "將路由器頁面對互聯網開放？")),
        h("div", { class: "wa-warning" }, icon("warning"), t("Anyone on the internet could reach the sign-in page, and bots will try your password all day. A VPN is the safe way to manage the router from outside.", "互聯網上任何人都可以去到登入頁，機械人會成日試你嘅密碼。想喺出面管理路由器，用 VPN 先安全。")),
        h("label", { class: "t2" }, t(`Type ${CONFIRM_WORD} to go on`, `輸入 ${CONFIRM_WORD} 繼續`)), typed,
        h("div", { class: "chips" }, h("button", { class: "btn t", onClick: () => close(false) }, t("Keep it closed", "保持關閉")), go),
      ];
    }, { label: t("Confirm opening to the internet", "確認對互聯網開放") });
    return (await dialog.closed) === true;
  };
  const toggle = h("button", { class: "btn sm", disabled: !entry || !ctx.state.canWrite || Boolean(entry?.disabled), async onClick() {
    if (open()) ctx.dock.setEntry(entry, "0");
    else if (await ask()) ctx.dock.setEntry(entry, "1");
    redraw();
  } }, open() ? t("Close it", "關閉") : t("Open it…", "開放…"));
  toggle.classList.add(open() ? "t" : "o");
  return h("section", { class: `card rise wa-exposure ${open() ? "bad" : "tone"}` },
    h("div", { class: "wa-pulse", "aria-hidden": "true" }, icon(open() ? "public" : "shield_lock", "lg")),
    h("h2", { class: "h2" }, open() ? t("The router page is open to the internet", "路由器頁面而家對互聯網開放") : t("The router page is closed to the internet", "路由器頁面而家對互聯網關閉")),
    h("div", { class: "t1" }, open()
      ? t("Anyone can reach the sign-in page. Close this unless you really need it, and turn on the address list below.", "任何人都去到登入頁。除非真係需要，否則請關閉，並且喺下面開名單。")
      : t("Only devices at home can open it. To manage the router from outside, use a VPN.", "淨係屋企嘅裝置開到。想喺出面管理，請用 VPN。")),
    h("div", { class: "chips" }, h("span", { class: `tag ${open() ? "bad" : "good"}` }, icon(open() ? "error" : "check_circle", "sm"), open() ? t("Open", "開放") : t("Closed", "關閉")), toggle),
    data.internet.open && !data.internet.onlyListed ? h("div", { class: "t2" }, icon("warning", "sm"), " ", t("It is open and the address list is off, so any address can try.", "已經開放，而名單又冇開，所以任何地址都可以試。")) : null);
}

function certificateCard(ctx, data) {
  const { api, h, icon, t } = ctx;
  const body = h("div", { class: "wa-cert" });
  const words = { fine: t("Valid", "有效"), soon: t("Expires soon", "快過期"), urgent: t("Expires this week", "今個星期過期"), expired: t("Expired", "已過期"), unknown: t("Unknown", "未知") };
  function paint(cert) {
    ctx.clear(body);
    const s = certificateState(cert);
    if (!cert.found) return void body.append(h("div", { class: "t2" }, cert.reason ?? t("No certificate could be read.", "讀唔到證書。")));
    const meter = h("i", {});
    meter.style.setProperty("--w", `${Math.round(s.share * 100)}%`);
    body.append(
      h("div", { class: "chips" }, h("span", { class: `tag ${s.tone}` }, icon(s.tone ? "warning" : "verified", "sm"), words[s.word]), cert.letsEncrypt ? h("span", { class: "tag" }, "Let's Encrypt") : null, cert.selfSigned ? h("span", { class: "tag warn" }, t("Self-signed", "自簽")) : null),
      h("div", { class: "big" }, cert.daysLeft < 0 ? t("Expired", "已過期") : t(`${cert.daysLeft} days left`, `仲有 ${cert.daysLeft} 日`)),
      h("div", { class: `meter ${s.tone}`, role: "meter", "aria-valuemin": "0", "aria-valuemax": "90", "aria-valuenow": String(Math.max(0, Math.min(90, cert.daysLeft))), "aria-label": t("Days left on the certificate", "證書剩餘日數"), "aria-valuetext": `${cert.daysLeft} days, ${s.word}` }, meter),
      h("div", { class: "t2" }, t(`Expires ${new Date(cert.expires).toLocaleDateString()}`, `到期日 ${new Date(cert.expires).toLocaleDateString()}`)),
      h("div", { class: "t2 wa-mono" }, `${t("Name", "名稱")}: ${cert.subject}`), h("div", { class: "t2 wa-mono" }, `${t("Issued by", "發證機構")}: ${cert.issuer}`));
  }
  paint(data.certificate);
  const refresh = h("button", { class: "btn t sm", async onClick() { try { paint(await api.get("/api/x/web-access/certificate")); } catch (error) { ctx.toast(error.message, "bad"); } } }, icon("refresh", "sm"), t("Read again", "重新讀取"));
  return h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Certificate", "證書")), body, h("div", {}, refresh));
}

async function screen(ctx) {
  const { api, h } = ctx;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/web-access");
  const holder = h("div", { class: "wa-stack" });
  page.append(holder);
  const draw = () => {
    ctx.clear(holder);
    const own = ctx.controls.settingGroups(data.entries);
    const ports = data.related.filter((x) => x.id !== "sys.remoteweb");
    holder.append(exposureCard(ctx, data, draw), certificateCard(ctx, data),
      ...own.map((g) => ctx.controls.groupCard(g.label, g.entries)),
      ports.length ? ctx.controls.groupCard({ en: "Ports and protocol", yue: "端口同協定" }, ports) : null);
  };
  draw();
  const off = ctx.bus.on("changed", async () => { data = await api.get("/api/domain/web-access"); draw(); });
  return off;
}

export default {
  id: "web-access",
  screens: [{ id: "web-access", group: { en: "Router", yue: "路由器" }, icon: "language", label, render: screen }],
  settings: [{ id: "web-access", icon: "language", label, async render(ctx) { const d = await ctx.api.get("/api/domain/web-access"); return ctx.controls.settingGroups(d.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [
    { id: "web-access.open", icon: "language", label: { en: "Open web access", yue: "開網頁存取" }, keywords: "https certificate letsencrypt autologout allowed addresses internet remote 證書 登出", run: (ctx) => ctx.navigate("web-access") },
    { id: "web-access.certificate", icon: "verified", label: { en: "When does my certificate expire?", yue: "我張證書幾時過期？" }, keywords: "certificate expiry expire https 證書 過期", run: (ctx) => ctx.navigate("web-access") },
  ],
  controls: { clientlist: clientListControl },
};
