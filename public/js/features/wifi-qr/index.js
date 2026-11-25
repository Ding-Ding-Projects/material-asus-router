// Wi-Fi QR screen: one card per network with a code that phones join with, and
// a printable card. The password is fetched only when a code is shown.
import { encode, toPath, wifiPayload } from "./qr.js";

const label = { en: "Wi-Fi QR codes", yue: "Wi-Fi QR 碼" };
const NS = "http://www.w3.org/2000/svg";

// The code as an SVG: white background with the quiet zone, black modules.
export function qrSvg(qr, { title }) {
  const margin = 4;
  const size = qr.size + margin * 2;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "qr-svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", title);
  svg.setAttribute("shape-rendering", "crispEdges");
  const back = document.createElementNS(NS, "rect");
  for (const [k, v] of Object.entries({ width: size, height: size, fill: "#ffffff" })) back.setAttribute(k, String(v));
  const dark = document.createElementNS(NS, "path");
  dark.setAttribute("d", toPath(qr, margin));
  dark.setAttribute("fill", "#000000");
  svg.append(back, dark);
  return svg;
}

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const data = await api.get("/api/domain/wifi-qr");
  const page = ctx.page(label, { en: "Let guests join by pointing a phone camera at a code, and print a card for the fridge.", yue: "訪客用手機相機掃描就可以連線，仲可以印張咭貼喺雪櫃。" });
  ctx.root.append(page);
  const cache = new Map();
  const shown = new Set();
  const list = h("div", { class: "grid2" });

  async function build(network) {
    if (cache.has(network.id)) return cache.get(network.id);
    const secret = await api.post("/api/x/wifi-qr/payload", { id: network.id });
    const payload = wifiPayload({ ssid: secret.ssid, password: secret.password, security: secret.security, hidden: secret.hidden });
    const qr = encode(payload, data.level);
    const built = { qr, password: secret.password, security: secret.security };
    cache.set(network.id, built);
    return built;
  }

  function printCard(network, built) {
    const sheet = h("div", { class: "qr-sheet" },
      h("div", { class: "qr-card" },
        h("h1", {}, t("Join our Wi-Fi", "連接我哋嘅 Wi-Fi")),
        qrSvg(built.qr, { title: network.ssid }),
        h("div", { class: "qr-ssid" }, network.ssid),
        h("div", { class: "qr-note" }, data.note || t("Scan with your phone camera to join.", "用手機相機掃描就可以連線。")),
        data.printPassword && built.password ? h("div", { class: "qr-pass" }, `${t("Password", "密碼")}: ${built.password}`) : null));
    document.body.append(sheet);
    document.body.classList.add("qr-printing");
    const done = () => { sheet.remove(); document.body.classList.remove("qr-printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }

  async function draw() {
    ctx.clear(list);
    for (const network of data.networks) {
      const box = h("div", { class: "qr-box" });
      const reveal = h("button", { class: "btn f sm", disabled: !network.enabled || !network.supported || !ctx.state.canWrite, onClick: async () => {
        try {
          const built = await build(network);
          shown.add(network.id);
          paint(box, network, built);
        } catch (error) {
          ctx.toast(error.message, "bad");
        }
      } }, icon("qr_code_2", "sm"), t("Show code", "顯示 QR 碼"));
      list.append(h("section", { class: "card rise" },
        h("div", { class: "k" }, `${network.kind === "guest" ? t("Guest network", "訪客網絡") : t("Network", "網絡")} · ${network.band}`),
        h("div", { class: "h2" }, network.ssid || "—"),
        h("div", { class: "chips" },
          h("span", { class: "tag" }, network.security === "nopass" ? t("Open", "開放") : network.security ?? t("Enterprise", "企業級")),
          network.hidden ? h("span", { class: "tag" }, t("Hidden name", "隱藏名稱")) : null,
          network.enabled ? null : h("span", { class: "tag warn" }, t("Off", "已關"))),
        !network.supported ? h("div", { class: "muted" }, t("Needs a user name to sign in, which a QR code cannot carry.", "要用戶名稱先登入到，QR 碼冇辦法帶。")) : null,
        !network.enabled ? h("div", { class: "muted" }, t("Turn this network on to make a code.", "開咗呢個網絡先可以整碼。")) : null,
        !ctx.state.canWrite ? h("div", { class: "muted" }, t("Viewer accounts cannot reveal the password, so cannot make a code.", "只讀帳戶睇唔到密碼，所以整唔到碼。")) : null,
        box, h("div", { class: "chips" }, reveal)));
      if (shown.has(network.id) && cache.has(network.id)) paint(box, network, cache.get(network.id));
    }
  }

  function paint(box, network, built) {
    ctx.clear(box).append(qrSvg(built.qr, { title: `${t("Wi-Fi code for", "Wi-Fi 碼：")} ${network.ssid}` }),
      h("div", { class: "t2" }, t(`Version ${built.qr.version}, error correction ${built.qr.level}. Point a phone camera at it to join.`, `版本 ${built.qr.version}，糾錯 ${built.qr.level}。用手機相機對住佢就可以連線。`)),
      h("div", { class: "chips" }, h("button", { class: "btn t sm", onClick: () => printCard(network, built) }, icon("print", "sm"), t("Print a card", "印咭")),
        h("button", { class: "btn o sm", onClick: () => { shown.delete(network.id); cache.delete(network.id); ctx.clear(box); } }, icon("visibility_off", "sm"), t("Hide", "隱藏"))));
  }

  page.append(list, ...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  await draw();
  // A code holds the password, so leave nothing behind when the screen is left.
  return () => { cache.clear(); shown.clear(); };
}

export default {
  id: "wifi-qr",
  screens: [{ id: "wifi-qr", group: { en: "Network", yue: "網絡" }, icon: "qr_code_2", label, render: screen }],
  settings: [{ id: "wifi-qr", icon: "qr_code_2", label, async render(ctx) { const data = await ctx.api.get("/api/domain/wifi-qr"); return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [{ id: "wifi-qr.open", icon: "qr_code_2", label: { en: "Show a Wi-Fi QR code", yue: "顯示 Wi-Fi QR 碼" }, keywords: "wifi qr code guest join print card password 二維碼 訪客 連線", run: (ctx) => ctx.navigate("wifi-qr") }],
};
