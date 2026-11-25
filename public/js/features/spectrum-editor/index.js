// Wi-Fi spectrum editor. The networks around you are drawn as curves from the
// router's own scan, and your network is the curve you can move: drag it to
// another channel, drag its edges to change its width, or use the arrow keys.
// Only channels and widths the router really offers can be picked. The choice
// waits in the pending-changes dock, so it is previewed, guarded and undoable.
import { axisRange, crowding, curvePath, halfSpan, nearestChannel, nearestWidth, stepChannel, stepWidth, widthChoices } from "./model.js";

const label = { en: "Spectrum editor", yue: "頻譜編輯器" };
const lede = { en: "Scan the air, then drag your own curve to a quieter channel. Drag its edges to change the width.", yue: "掃描一下空氣，再將你自己嗰條曲線拖去較靜嘅頻道。拖曲線兩邊就可以改闊度。" };
const NS = "http://www.w3.org/2000/svg";
const W = 700;
const H = 280;
const PAD = { l: 44, r: 14, t: 14, b: 34 };
const RESCAN_MS = 30000;

function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const info = await api.get("/api/domain/channel-analyser");
  let current = info.bands.find((b) => b.radio)?.index ?? info.bands[0]?.index ?? 0;
  const scans = new Map();
  let scanning = false;
  let live = false;
  let timer = null;
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Wi-Fi band", "Wi-Fi 頻段") });
  const body = h("div", { class: "se-body" });
  const announce = h("div", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  const entryOf = (id) => ctx.state.catalog.entries.find((e) => e.id === id);
  const valueOf = (e) => (e && ctx.dock.has(e.id) ? ctx.dock.value(e.id) : e?.value);

  async function scan() {
    if (scanning) return;
    scanning = true;
    draw();
    try {
      scans.set(current, await api.get(`/api/x/channel-analyser/scan?band=${current}`));
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    scanning = false;
    draw();
  }

  function chart(scan, band, channelEntry, widthEntry) {
    const candidates = (channelEntry?.options ?? []).map(([v]) => Number(v)).filter((c) => c > 0);
    const choices = widthChoices(widthEntry);
    const own = scan.ownChannel;
    const stagedChannel = channelEntry && ctx.dock.has(channelEntry.id) ? Number(ctx.dock.value(channelEntry.id)) : null;
    const wantChannel = Number(valueOf(channelEntry) ?? 0);
    const wantWidth = widthEntry ? valueOf(widthEntry) : null;
    const widthNow = choices.find((c) => c.value === wantWidth)?.mhz || (band === "2.4" ? 20 : 80);
    const centre0 = wantChannel > 0 ? wantChannel : own ?? candidates[0] ?? 1;
    const [lo, hi] = axisRange(band, candidates, scan.networks, own);
    const x = (c) => PAD.l + ((W - PAD.l - PAD.r) * (c - lo)) / (hi - lo);
    const y = (rssi) => PAD.t + (H - PAD.t - PAD.b) * (1 - Math.min(1, Math.max(0, (rssi + 100) / 60)));
    const base = H - PAD.b;
    const fromX = (clientX, root) => {
      const r = root.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      return lo + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (hi - lo);
    };
    const root = svg("svg", { class: "se-chart", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": t("Neighbouring networks by channel, and your own network", "鄰近網絡按頻道分佈，同你自己嘅網絡"), preserveAspectRatio: "xMidYMid meet" });
    for (const dbm of [-100, -85, -70, -55, -40]) root.append(svg("line", { class: "grid", x1: PAD.l, x2: W - PAD.r, y1: y(dbm), y2: y(dbm) }), svg("text", { class: "axis", x: PAD.l - 6, y: y(dbm) + 4, "text-anchor": "end" }, String(dbm)));
    const crowd = crowding(scan.channels, candidates);
    for (const c of candidates) {
      root.append(svg("rect", { class: "slot", x: x(c) - 7, y: base + 2, width: 14, height: 5, rx: 2, opacity: 0.25 + 0.75 * (crowd.get(c) ?? 0) }), svg("text", { class: `axis cand${c === own ? " own" : ""}`, x: x(c), y: H - 8, "text-anchor": "middle" }, String(c)));
    }
    scan.networks.forEach((n, i) => {
      const nw = { centre: n.channel, width: n.width ?? 20, rssi: n.rssi };
      root.append(svg("path", { class: `net s${i % 5}`, d: curvePath(nw, x, y, base) }, svg("title", {}, `${n.ssid || t("(hidden)", "（隱藏）")} · ${t("channel", "頻道")} ${n.channel} · ${n.rssi} dBm`)));
    });

    // Your own network: a curve you can move, with a handle on each edge for the width.
    let moving = { channel: centre0, width: widthNow };
    const own$ = svg("g", { class: "own-curve", tabindex: canWrite ? "0" : "-1", role: "slider", "aria-label": t("Your network. Left and right arrows change the channel, up and down change the width.", "你嘅網絡。左右方向鍵轉頻道，上下方向鍵轉闊度。"), "aria-valuemin": candidates[0] ?? 0, "aria-valuemax": candidates.at(-1) ?? 0, "aria-valuenow": centre0, "aria-valuetext": `${t("channel", "頻道")} ${centre0}, ${widthNow} MHz` });
    const shape = svg("path", { class: "mine" });
    const ghost = svg("path", { class: "mine ghost", opacity: 0 });
    const left = svg("circle", { class: "handle", r: 9, cy: base - 3 });
    const right = svg("circle", { class: "handle", r: 9, cy: base - 3 });
    const tag = svg("text", { class: "axis name", "text-anchor": "middle" }, t("Your network", "你嘅網絡"));
    const place = (c, w) => {
      shape.setAttribute("d", curvePath({ centre: c, width: w, rssi: -45 }, x, y, base));
      {
        left.setAttribute("cx", x(c - halfSpan(w)));
        right.setAttribute("cx", x(c + halfSpan(w)));
        tag.setAttribute("x", x(c));
        tag.setAttribute("y", y(-45) - 6);
        own$.setAttribute("aria-valuenow", c);
        own$.setAttribute("aria-valuetext", `${t("channel", "頻道")} ${c}, ${w} MHz`);
      }
    };
    place(centre0, widthNow);
    if (own && stagedChannel !== null && stagedChannel !== own) {
      ghost.setAttribute("d", curvePath({ centre: own, width: widthNow, rssi: -45 }, x, y, base));
      ghost.setAttribute("opacity", 0.9);
    }
    own$.append(shape, left, right, tag);
    root.prepend(ghost);
    root.append(own$);

    const stageChannel = (c) => {
      if (!channelEntry || channelEntry.disabled) return;
      if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn");
      ctx.dock.setEntry(channelEntry, String(c));
      announce.textContent = t(`Channel ${c} is waiting in your pending changes.`, `頻道 ${c} 已加入待套用變更。`);
      draw();
    };
    const stageWidth = (choice) => {
      if (!widthEntry || widthEntry.disabled || !choice) return;
      if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn");
      ctx.dock.setEntry(widthEntry, choice.value);
      announce.textContent = t(`Width ${choice.mhz} MHz is waiting in your pending changes.`, `闊度 ${choice.mhz} MHz 已加入待套用變更。`);
      draw();
    };

    // Dragging with the pointer: the body moves the channel, an edge handle changes the width.
    const drag = (el, move, done) => {
      el.addEventListener("pointerdown", (e) => {
        if (!canWrite || e.button > 0) return;
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture?.(e.pointerId);
        root.classList.add("dragging");
        const onMove = (ev) => move(fromX(ev.clientX, root));
        const onUp = () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
          root.classList.remove("dragging");
          done();
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onUp);
      });
    };
    drag(shape, (pos) => {
      const c = nearestChannel(candidates, pos);
      if (c) (moving = { ...moving, channel: c }, place(c, moving.width));
    }, () => moving.channel !== centre0 && stageChannel(moving.channel));
    for (const handle of [left, right])
      drag(handle, (pos) => {
        const pick = nearestWidth(choices, Math.abs(pos - moving.channel) * 10);
        if (pick) (moving = { ...moving, width: pick.mhz, choice: pick }, place(moving.channel, pick.mhz));
      }, () => moving.choice && moving.width !== widthNow && stageWidth(moving.choice));
    own$.addEventListener("keydown", (e) => {
      if (!canWrite) return;
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      const wdir = { ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (dir) (e.preventDefault(), stageChannel(stepChannel(candidates, centre0, dir)));
      else if (wdir) (e.preventDefault(), stageWidth(stepWidth(choices, wantWidth, wdir)));
    });
    return root;
  }

  function draw() {
    const b = info.bands.find((x) => x.index === current);
    ctx.clear(tabs).append(...info.bands.map((x) => h("button", { type: "button", role: "radio", "aria-checked": String(x.index === current), class: x.index === current ? "on" : "", onClick() { current = x.index; draw(); } }, `${x.band} GHz`)));
    const scanData = scans.get(current);
    const channelEntry = entryOf(`wl${current}.channel`);
    const widthEntry = entryOf(`wl${current}.width`);
    ctx.clear(body).append(
      h("div", { class: "chips" },
        h("button", { type: "button", class: "btn f", disabled: scanning || !b?.radio, onClick: scan }, icon(scanning ? "hourglass_top" : "wifi_find", "sm"), scanning ? t("Listening…", "聆聽緊…") : t("Scan this band", "掃描呢個頻段")),
        h("button", { type: "button", class: `chip${live ? " on" : ""}`, role: "switch", "aria-checked": String(live), onClick() { live = !live; clearInterval(timer); if (live) timer = setInterval(() => !scanning && !document.hidden && scan(), RESCAN_MS); draw(); } }, icon(live ? "sync" : "sync_disabled", "sm"), live ? t("Rescanning every 30 seconds", "每 30 秒重新掃描") : t("Rescan every 30 seconds", "每 30 秒重新掃描")),
        b && !b.radio ? h("span", { class: "tag warn" }, icon("wifi_off", "sm"), t("This band's radio is off.", "呢個頻段電台未開。")) : null),
      h("div", { class: "muted" }, t("While scanning, devices on this band can pause for a moment.", "掃描嗰陣，呢個頻段連住嘅裝置可能會停頓一陣。")),
      !scanData ? h("div", { class: "empty" }, icon("wifi_find", "lg"), t("Press scan to listen to the air around the router.", "撳掃描，聽吓路由器周圍嘅無線電。"))
        : [chart(scanData, b.band, channelEntry, widthEntry),
          h("div", { class: "t2" }, t(`${scanData.counted} of ${scanData.scanned} networks counted. Wider neighbours are drawn around their main channel, so their edges are approximate.`, `${scanData.scanned} 個網絡中計入 ${scanData.counted} 個。較闊嘅鄰居以主頻道為中心畫，所以兩邊只係大約位置。`)),
          controls(scanData, channelEntry, widthEntry)]);
  }

  function controls(scanData, channelEntry, widthEntry) {
    const r = scanData.recommendation;
    const staged = channelEntry && ctx.dock.has(channelEntry.id);
    return h("div", { class: "se-controls" },
      r ? h("div", { class: `card ${r.keep ? "ter" : "sec"}` }, h("div", { class: "k" }, t("Quietest channel", "最靜嘅頻道")), h("div", { class: "big" }, String(r.channel)),
        h("div", { class: "t2" }, r.keep ? t("You are already on a quiet channel.", "你已經喺一個靜嘅頻道。") : r.improvement ? t(`About ${r.improvement}% less interference than now.`, `干擾比而家少大約 ${r.improvement}%。`) : tt({ en: r.note ?? "", yue: "路由器自動揀頻道，所以冇現時頻道可以比較。" })),
        h("button", { type: "button", class: "btn f sm", disabled: !canWrite || r.keep || !channelEntry || Boolean(channelEntry.disabled), onClick() { ctx.dock.setEntry(channelEntry, String(r.channel)); draw(); } }, icon("check", "sm"), t("Move my curve there", "將我條曲線移去嗰度"))) : null,
      channelEntry ? h("div", { class: "chips", role: "group", "aria-label": t("Channel", "頻道") }, channelEntry.options.map(([v, l]) => h("button", { type: "button", class: `chip${valueOf(channelEntry) === v ? " on" : ""}`, "aria-pressed": String(valueOf(channelEntry) === v), disabled: !canWrite || Boolean(channelEntry.disabled), onClick() { ctx.dock.setEntry(channelEntry, v); draw(); } }, tt(l)))) : null,
      widthEntry ? h("div", { class: "chips", role: "group", "aria-label": t("Channel width", "頻寬") }, widthEntry.options.map(([v, l]) => h("button", { type: "button", class: `chip${valueOf(widthEntry) === v ? " on" : ""}`, "aria-pressed": String(valueOf(widthEntry) === v), disabled: !canWrite || Boolean(widthEntry.disabled), onClick() { ctx.dock.setEntry(widthEntry, v); draw(); } }, tt(l)))) : null,
      staged ? h("div", { class: "note" }, icon("pending"), t("The new channel is waiting in your pending changes. Changing it can drop Wi-Fi for a moment, so the safety net is armed.", "新頻道喺待套用變更入面。轉頻道可能令 Wi-Fi 斷一陣，所以會開啟安全機制。")) : null);
  }

  page.append(h("section", { class: "card rise" }, tabs, body, announce));
  draw();
  return () => clearInterval(timer);
}

export default {
  id: "spectrum-editor",
  screens: [{ id: "spectrum-editor", group: { en: "Network", yue: "網絡" }, icon: "graphic_eq", label, render: screen }],
  commands: [{ id: "spectrum-editor.open", icon: "graphic_eq", label: { en: "Open the spectrum editor", yue: "開啟頻譜編輯器" }, keywords: "wifi channel width spectrum scan neighbour interference drag 頻道 頻寬 頻譜", run: (ctx) => ctx.navigate("spectrum-editor") }],
};
