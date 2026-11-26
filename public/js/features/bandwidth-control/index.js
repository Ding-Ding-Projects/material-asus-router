// Kick and ban: share the connection fairly by pausing one device for a while (kick) or until
// lifted (ban). Each device has a Kick button; the sheet picks how and how long, shows who is
// affected, and warns when the device belongs to your brother. Running pauses can be lifted here
// or by the person on the paused device, from the Unkick page, without an account.

const label = { en: "Kick and ban", yue: "踢走同封鎖" };

export const minutesText = (m, t) => (m >= 60 ? t(`${m / 60} h`, `${m / 60} 小時`) : t(`${m} min`, `${m} 分鐘`));

export function untilText(hold, t, now = Date.now()) {
  if (hold.until === null) return t("until lifted", "直到解除");
  const left = Math.max(0, Math.round((hold.until - now) / 60000));
  const at = new Date(hold.until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return t(`until ${at}, ${left} min left`, `直到 ${at}，仲有 ${left} 分鐘`);
}

async function screen(ctx) {
  const { api, h, icon, t, tt, clear } = ctx;
  const page = ctx.page(label, { en: "Pause a device's internet to share the connection fairly. The person on that device can always lift it themselves from the Unkick page.", yue: "暫停一部裝置上網，令大家公平咁用網絡。用緊嗰部裝置嘅人永遠可以喺「解除暫停」頁自己解除。" });
  ctx.root.append(page);
  const holdsBox = h("section", { class: "card kick-holds", "aria-live": "polite" });
  const devicesBox = h("section", { class: "card" });
  const logBox = h("section", { class: "card" });
  const link = `${location.origin}/unkick.html`;
  page.append(
    h("section", { class: "card tone kick-unkick" },
      h("div", { class: "k" }, t("For the person who was paused", "俾被暫停嘅人")),
      h("p", {}, t("Open this page on the paused device. It lifts the pause on that device only, and the lift is recorded.", "喺被暫停嘅裝置打開呢頁，佢淨係會解除嗰部裝置嘅暫停，並會記錄低。")),
      h("div", { class: "actions" },
        h("a", { class: "btn o", href: link, target: "_blank", rel: "noopener" }, icon("open_in_new", "sm"), t("Open the Unkick page", "打開解除暫停頁")),
        h("button", { class: "btn t", onClick: () => ctx.copyText ? ctx.copyText(link) : navigator.clipboard?.writeText(link) }, icon("content_copy", "sm"), t("Copy the link", "複製連結")))),
    holdsBox, devicesBox, logBox);

  let data = { methods: {}, durations: [], holds: [], log: [] };
  let devices = [];
  let household = { members: [] };

  const ownerOf = (mac) => household.members.find((m) => (m.devices ?? []).some((d) => String(d?.mac ?? d).toUpperCase() === mac));
  const nameOf = (d) => d.name || d.hostname || d.mac;

  function drawHolds() {
    clear(holdsBox).append(h("div", { class: "k" }, t("Paused now", "而家暫停緊")));
    if (!data.holds.length) return holdsBox.append(h("p", { class: "t2" }, t("Nobody is paused.", "冇人被暫停。")));
    holdsBox.append(h("ul", { class: "kick-list" }, data.holds.map((hold) => h("li", { class: "kick-row" },
      icon(hold.ban ? "block" : "pan_tool"),
      h("div", { class: "grow" },
        h("div", { class: "t1" }, `${hold.name || hold.mac} · ${hold.ban ? t("Banned", "封鎖") : t("Kicked", "踢走")}`),
        h("div", { class: "t2" }, `${tt(data.methods[hold.method]?.label)} · ${untilText(hold, t)} · ${t("by", "由")} ${hold.by}${hold.note ? ` · ${hold.note}` : ""}`)),
      h("button", { class: "btn f sm", onClick: () => lift(hold) }, icon("lock_open", "sm"), hold.ban ? t("Unban", "解除封鎖") : t("Unkick", "解除暫停"))))));
  }

  function drawDevices() {
    const paused = new Set(data.holds.map((x) => x.mac));
    clear(devicesBox).append(h("div", { class: "k" }, t("Devices", "裝置")));
    if (!devices.length) return devicesBox.append(h("p", { class: "t2" }, t("The router lists no devices right now.", "路由器而家冇列出任何裝置。")));
    devicesBox.append(h("ul", { class: "kick-list" }, devices.map((d) => {
      const owner = ownerOf(d.mac);
      return h("li", { class: "kick-row" },
        icon(d.iface === "wireless" ? "wifi" : "lan"),
        h("div", { class: "grow" },
          h("div", { class: "t1" }, nameOf(d)),
          h("div", { class: "t2" }, [d.ip, d.mac, owner ? `${t("belongs to", "屬於")} ${owner.name}` : null, d.online ? t("online", "在線") : t("offline", "離線")].filter(Boolean).join(" · "))),
        paused.has(d.mac) ? h("span", { class: "chip" }, t("Paused", "暫停緊")) : null,
        h("button", { class: "btn o sm", "aria-label": `${t("Kick", "踢走")} ${nameOf(d)}`, onClick: () => sheet(d) }, icon("pan_tool", "sm"), t("Kick", "踢走")));
    })));
  }

  function drawLog() {
    clear(logBox).append(h("div", { class: "k" }, t("Recent", "最近")));
    if (!data.log.length) return logBox.append(h("p", { class: "t2" }, t("Nothing yet.", "未有紀錄。")));
    const words = { kick: t("kicked", "踢走"), ban: t("banned", "封鎖"), unkick: t("unkicked", "解除暫停"), unban: t("unbanned", "解除封鎖"), disconnect: t("disconnected from Wi-Fi", "斷開 Wi-Fi") };
    logBox.append(h("ul", { class: "kick-log" }, data.log.slice(0, 20).map((e) => h("li", {},
      h("time", { datetime: e.at }, new Date(e.at).toLocaleString([], { hour12: false })), ` ${e.by} ${words[e.event] ?? e.event} ${e.name || e.mac}`))));
  }

  async function load() {
    try {
      [data, devices, household] = await Promise.all([
        api.get("/api/domain/bandwidth-control"),
        api.get("/api/domain/devices").then((r) => r.devices ?? []).catch(() => []),
        api.get("/api/household").catch(() => ({ members: [] })),
      ]);
      drawHolds();
      drawDevices();
      drawLog();
    } catch (error) {
      clear(holdsBox).append(h("p", { class: "t2 bad", role: "alert" }, error.message));
    }
  }

  async function lift(hold) {
    try {
      await api.del(`/api/x/bandwidth-control/hold/${encodeURIComponent(hold.id)}`);
      ctx.toast(hold.ban ? t("Unbanned.", "已解除封鎖。") : t("Unkicked.", "已解除暫停。"));
      await load();
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  }

  function sheet(device) {
    const owner = ownerOf(device.mac);
    const brother = Boolean(owner && /brother|兄弟/i.test(owner.name ?? ""));
    const who = nameOf(device);
    const choice = { method: "pause", minutes: 30, ban: false, note: "", busy: false, error: "" };
    const title = t(`Kick ${who}`, `踢走 ${who}`);
    const radio = (on, text, pick) => h("button", { type: "button", role: "radio", "aria-checked": String(on), class: on ? "on" : "", onClick: pick }, text);
    ctx.openDialog((done, redraw) => {
      async function go() {
        choice.busy = true;
        choice.error = "";
        redraw();
        try {
          const out = await api.post("/api/x/bandwidth-control/hold", { mac: device.mac, name: device.name || device.hostname || "", method: choice.method, minutes: choice.minutes, ban: choice.ban, note: choice.note });
          ctx.toast(out.disconnected ? t("Disconnected from Wi-Fi once.", "已斷開 Wi-Fi 一次。") : choice.ban ? t("Banned until lifted.", "已封鎖，直到解除。") : t(`Kicked for ${minutesText(choice.minutes, t)}.`, `已踢走 ${minutesText(choice.minutes, t)}。`));
          done(true);
          await load();
        } catch (error) {
          choice.busy = false;
          choice.error = error.message;
          redraw();
        }
      }
      const timed = choice.method !== "disconnect";
      return [
        h("h2", { class: "h2" }, title),
        h("p", {}, t(`This pauses ${who} only. Everyone else keeps their internet.`, `只會暫停 ${who}，其他人照常上網。`)),
        h("div", { class: `kick-impact ${brother ? "mad" : ""}` }, icon(brother ? "sentiment_extremely_dissatisfied" : "info", "sm"),
          h("span", {}, brother ? t(`Level 1 for the network, but this is ${owner.name}'s device: expect your brother to notice.`, `對網絡係 1 級，但呢部係 ${owner.name} 嘅裝置：你個兄弟應該會發現。`) : t("Level 1: one device, nobody else is affected.", "1 級：得一部裝置，其他人唔受影響。"))),
        h("div", { class: "k" }, t("How", "點樣")),
        h("div", { class: "seg wrap", role: "radiogroup", "aria-label": t("How to pause", "點樣暫停") }, Object.entries(data.methods).map(([id, m]) => radio(choice.method === id, tt(m.label), () => { choice.method = id; redraw(); }))),
        h("p", { class: "t2" }, tt(data.methods[choice.method]?.about)),
        timed ? h("div", { class: "k" }, t("For how long", "幾耐")) : null,
        timed ? h("div", { class: "seg wrap", role: "radiogroup", "aria-label": t("For how long", "幾耐") },
          data.durations.map((m) => radio(!choice.ban && choice.minutes === m, minutesText(m, t), () => { choice.ban = false; choice.minutes = m; redraw(); })),
          radio(choice.ban, t("Until lifted (ban)", "直到解除（封鎖）"), () => { choice.ban = true; redraw(); })) : null,
        timed && choice.ban ? h("p", { class: "t2" }, t("A ban stays after the router restarts. The person on that device can still lift it from the Unkick page.", "封鎖喺路由器重啟之後都會保留。用緊嗰部裝置嘅人仍然可以喺解除暫停頁自己解除。")) : null,
        h("label", { class: "lbl" }, t("Note for them (optional)", "俾佢嘅留言（可選）"), h("input", { class: "field", maxlength: "120", value: choice.note, placeholder: t("Homework first", "做完功課先"), onInput: (e) => (choice.note = e.target.value) })),
        choice.error ? h("p", { class: "bad", role: "alert" }, choice.error) : null,
        h("div", { class: "actions" },
          h("button", { class: "btn o", onClick: () => done(false) }, t("Cancel", "取消")),
          h("button", { class: "btn f", disabled: choice.busy, onClick: go }, icon("pan_tool", "sm"), choice.busy ? t("Working...", "處理緊...") : !timed ? t("Disconnect", "斷開") : choice.ban ? t("Ban", "封鎖") : t("Kick", "踢走"))),
      ];
    }, { label: title });
  }

  await load();
  // Ends finished pauses and puts rules back after a router restart while the screen is open.
  const timer = setInterval(async () => {
    try {
      await api.post("/api/x/bandwidth-control/sync");
      await load();
    } catch {}
  }, 30000);
  return () => clearInterval(timer);
}

export default {
  id: "bandwidth-control",
  screens: [{ id: "bandwidth-control", group: { en: "Devices", yue: "裝置" }, icon: "pan_tool", label, render: screen }],
  commands: [
    { id: "bandwidth-control.open", icon: "pan_tool", label: { en: "Kick or ban a device", yue: "踢走或者封鎖一部裝置" }, keywords: "kick ban unkick unban pause bandwidth share 踢 封鎖 暫停", run: (ctx) => ctx.navigate("bandwidth-control") },
    { id: "bandwidth-control.unkick-page", icon: "lock_open", label: { en: "Open the Unkick page", yue: "打開解除暫停頁" }, keywords: "unkick unban lift 解除", run: () => window.open("/unkick.html", "_blank", "noopener") },
  ],
};
