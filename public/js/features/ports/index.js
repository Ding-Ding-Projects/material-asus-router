// Ports: the back of the router drawn as live port jacks (link, speed, duplex),
// the chip that drives them, what each LAN number is used for, and the switch
// settings that live on no other screen (hardware acceleration, jumbo frame
// size, IPTV multicast). The jacks refresh every few seconds while the screen
// is open. Port status is read only; every setting goes through the dock.

const label = { en: "Ports", yue: "網絡埠" };
const lede = { en: "Which wired ports are connected, how fast each one runs, and the switch settings behind them.", yue: "邊啲有線埠接咗線、各自跑幾快，同埋背後嘅交換器設定。" };
const REFRESH_MS = 4000;

export const speedText = (mbps) => (mbps >= 1000 ? `${mbps / 1000} Gbps` : mbps > 0 ? `${mbps} Mbps` : "");
// good: a fast link, warn: connected but slow (under 1 Gbps), off: nothing plugged in, bad: switched off.
export const linkTone = (port) => (port.up ? (port.speed >= 1000 ? "good" : "warn") : port.enabled === false ? "bad" : "off");

const lan = (role) => `LAN ${role.lan.join(" + ")}`;
const ROLE_TEXT = {
  iptv: { icon: "live_tv", en: (r) => `IPTV box on ${lan(r)}`, yue: (r) => `IPTV 機頂盒喺 ${lan(r)}` },
  "second-internet": { icon: "swap_vert", en: (r) => `Second internet line on ${lan(r)}`, yue: (r) => `第二條上網線喺 ${lan(r)}` },
  aggregation: { icon: "merge", en: () => "Link aggregation is on", yue: () => "鏈路聚合已開" },
  jumbo: { icon: "expand", en: () => "Jumbo frames are on", yue: () => "巨型幀已開" },
  "accel-off": { icon: "speed", en: () => "Hardware acceleration is partly off", yue: () => "硬件加速部分已關" },
};

function diagram(ctx, root) {
  const { api, h, icon, t } = ctx;
  const jacks = h("div", { class: "pt-jacks", role: "list" });
  const detail = h("div", { class: "pt-detail", "aria-live": "polite" });
  const chip = h("span", { class: "tag" });
  const stamp = h("span", { class: "t2" });
  const roles = h("div", { class: "chips pt-roles" });
  const empty = h("div", { class: "empty pt-empty", hidden: true }, icon("cable", "lg"), h("div", {}, t("This router did not report its ports, so there is nothing to draw. Its switch settings below still work.", "呢部路由器冇報告網絡埠，所以冇嘢畫。下面嘅交換器設定照用得。")));
  const shown = new Map(); // port id -> { el, speed, state, tone }
  let selected = null;
  let last = null;
  let first = true;

  const word = (port) => (port.up
    ? t(`Connected at ${speedText(port.speed)}${port.duplex ? `, ${port.duplex} duplex` : ""}`, `已連線，${speedText(port.speed)}${port.duplex ? `，${port.duplex === "full" ? "全雙工" : "半雙工"}` : ""}`)
    : port.enabled === false ? t("Switched off", "已關閉") : t("Nothing plugged in", "冇插線"));
  const name = (port) => port.name ?? t(`Port ${port.number}`, `埠 ${port.number}`);

  function drawDetail() {
    const port = last?.ports.find((p) => p.id === selected);
    detail.replaceChildren();
    if (!port) return void detail.append(h("div", { class: "t2" }, t("Choose a port to see its details.", "揀一個埠睇詳細資料。")));
    detail.append(
      h("div", { class: "t1" }, name(port)),
      h("div", { class: "t2" }, word(port)),
      port.jumbo !== null ? h("div", { class: "t2" }, port.jumbo ? t("Jumbo frames are on for this port.", "呢個埠已開巨型幀。") : t("Jumbo frames are off for this port.", "呢個埠冇開巨型幀。")) : null,
      port.speed > 0 && port.speed < 1000 ? h("div", { class: "t2" }, t("Under 1 Gbps. A damaged cable or an old device can cause this.", "低過 1 Gbps。線有問題或者裝置太舊都可能係原因。")) : null);
  }

  function paint(view) {
    const previous = last;
    last = view;
    chip.textContent = ctx.tt(view.chipset.label);
    stamp.textContent = t(`Updated ${new Date(view.readAt).toLocaleTimeString()}`, `更新於 ${new Date(view.readAt).toLocaleTimeString()}`);
    roles.replaceChildren(...view.roles.map((r) => {
      const text = ROLE_TEXT[r.kind];
      return text ? h("span", { class: "tag" }, icon(text.icon, "sm"), ctx.getLang() === "yue" ? text.yue(r) : text.en(r)) : null;
    }));
    empty.hidden = view.ports.length > 0;
    const gone = new Set(shown.keys());
    view.ports.forEach((port, index) => {
      gone.delete(port.id);
      const tone = linkTone(port);
      let entry = shown.get(port.id);
      if (!entry) {
        const nameEl = h("span", { class: "pt-name" });
        const speed = h("b", { class: "pt-speed" });
        const state = h("span", { class: "pt-state" });
        const el = h("button", {
          class: "pt-jack",
          role: "listitem",
          type: "button",
          onClick: () => {
            selected = port.id;
            for (const [id, e] of shown) e.el.setAttribute("aria-pressed", String(id === selected));
            drawDetail();
          },
        }, h("span", { class: "pt-socket", "aria-hidden": "true" }, h("i", { class: "pt-led" })), nameEl, speed, state);
        el.style.setProperty("--i", String(index));
        entry = { el, nameEl, speed, state, tone: null };
        shown.set(port.id, entry);
        jacks.append(el);
      }
      entry.nameEl.textContent = name(port);
      entry.speed.textContent = port.up ? speedText(port.speed) : "";
      entry.state.textContent = port.up ? t("Connected", "已連線") : port.enabled === false ? t("Off", "關閉") : t("Empty", "冇線");
      entry.el.setAttribute("aria-label", `${name(port)}: ${word(port)}`);
      entry.el.setAttribute("aria-pressed", String(port.id === selected));
      if (entry.tone !== tone) {
        entry.el.dataset.tone = tone;
        const before = previous?.ports.find((p) => p.id === port.id);
        if (before && entry.tone !== null) {
          // A link coming up bursts, a link dropping shakes; a speed change only flashes.
          const cls = port.up && !before.up ? "burst" : !port.up && before.up ? "drop" : "flash";
          entry.el.classList.remove("burst", "drop", "flash");
          void entry.el.offsetWidth;
          entry.el.classList.add(cls);
          ctx.toast(port.up && !before.up
            ? t(`${name(port)} is now connected at ${speedText(port.speed)}.`, `${name(port)} 而家連咗線，${speedText(port.speed)}。`)
            : !port.up && before.up ? t(`${name(port)} lost its link.`, `${name(port)} 斷咗線。`) : t(`${name(port)} now runs at ${speedText(port.speed)}.`, `${name(port)} 而家速度係 ${speedText(port.speed)}。`));
        }
        entry.tone = tone;
      }
    });
    for (const id of gone) {
      shown.get(id).el.remove();
      shown.delete(id);
    }
    first = false;
    drawDetail();
  }

  async function read() {
    try {
      paint(await api.get("/api/x/ports/status"));
    } catch (error) {
      stamp.textContent = error.message;
    }
  }

  const refresh = h("button", { class: "btn t sm", onClick: read }, icon("refresh", "sm"), t("Refresh", "重新整理"));
  root.append(h("section", { class: "card rise pt-panel" },
    h("div", { class: "pt-head" }, h("h2", { class: "h2" }, t("Ports", "網絡埠")), chip, refresh),
    h("div", { class: "t2" }, t("Port numbers are the switch chip's own numbers, which do not always match the labels printed on the case. The list refreshes while this screen is open.", "埠號係交換晶片自己嘅號碼，唔一定同機身標籤一樣。呢個畫面開住時會自動更新。")),
    jacks, empty, roles, detail, stamp));
  const timer = setInterval(() => !document.hidden && read(), REFRESH_MS);
  return { read, stop: () => clearInterval(timer), paint, isFirst: () => first };
}

function elsewhere(ctx, data) {
  const { h, icon, t, tt } = ctx;
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("alt_route", "sm"), " ", t("More port settings on other screens", "其他畫面嘅埠設定")),
    data.elsewhere.map((item) => h("div", { class: "row" }, icon("arrow_forward"), h("div", { class: "grow" }, h("div", { class: "t1" }, tt(item.label)), h("div", { class: "t2" }, tt(item.about))),
      h("button", { class: "btn o sm", onClick: () => ctx.navigate(item.id) }, t("Open", "開啟")))));
}

export default {
  id: "ports",
  screens: [{
    id: "ports",
    group: { en: "Network", yue: "網絡" },
    icon: "settings_ethernet",
    label,
    async render(ctx) {
      const data = await ctx.api.get("/api/domain/ports");
      const page = ctx.page(label, lede);
      ctx.root.append(page);
      const view = diagram(ctx, page);
      view.paint(data);
      const grid = ctx.h("div", { class: "grid2" }, ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
      page.append(grid, elsewhere(ctx, data));
      const off = ctx.bus.on("lang", () => view.paint(data));
      return () => {
        view.stop();
        off();
      };
    },
  }],
  settings: [{
    id: "ports",
    icon: "settings_ethernet",
    label,
    async render(ctx) {
      const data = await ctx.api.get("/api/domain/ports");
      return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
    },
  }],
  commands: [
    { id: "ports.open", icon: "settings_ethernet", label: { en: "Open the ports", yue: "開啟網絡埠" }, keywords: "ports link speed gigabit lan cable switch iptv multicast acceleration ctf jumbo", run: (ctx) => ctx.navigate("ports") },
  ],
};
