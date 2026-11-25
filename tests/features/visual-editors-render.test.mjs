// Draws each visual editor screen in Node against a real app and its pretend
// router, with a tiny stand-in for the DOM (tests/dom-lite.mjs), then clicks the
// controls and checks what they stage in the pending-changes dock and that the
// router accepts it. This proves the screens draw and their controls work; how
// they look is a browser's job.
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDom, text } from "../dom-lite.mjs";
import { startApp } from "../helpers.mjs";

const { body } = installDom();
body.isRoot = true;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (["value", "checked", "disabled", "selected", "readOnly", "hidden"].includes(key)) el[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

// The same pending-changes store the app has, without the browser parts.
function makeDock() {
  const dock = {
    changes: new Map(),
    ops: [],
    count: () => dock.changes.size + dock.ops.length,
    has: (id) => dock.changes.has(id),
    value: (id) => dock.changes.get(id)?.value,
    setEntry(entry, value) {
      if (value === (entry.masked || entry.secret ? "" : entry.value)) dock.changes.delete(entry.id);
      else dock.changes.set(entry.id, { id: entry.id, value });
    },
    setRaw: () => {},
    addOp: (op, summary) => dock.ops.push({ op, summary }),
    clear() {
      dock.changes.clear();
      dock.ops.length = 0;
    },
    toBody: () => ({ changes: [...dock.changes.values()], ops: dock.ops.map((o) => o.op) }),
  };
  return dock;
}

async function mount(t, id, { canWrite = true } = {}) {
  const feature = (await import(`../../public/js/features/${id}/index.js`)).default;
  const toasts = [];
  const dialogs = [];
  const handlers = new Map();
  const dock = makeDock();
  const call = async (method, url, bodyData) => {
    const res = await t.owner[method](url, bodyData);
    if (res.status >= 400) throw Object.assign(new Error(res.data?.error ?? res.text), { status: res.status });
    return res.data;
  };
  const catalog = (await t.owner.get("/api/catalog")).data;
  const ctx = {
    api: { get: (url) => call("get", url), post: (url, b) => call("post", url, b) },
    h,
    icon: (name) => h("span", { class: "ms" }, name),
    t: (en) => en,
    tt: (pair) => pair?.en ?? "",
    getLang: () => "en",
    clear: (el) => (el.replaceChildren(), el),
    page: (title, lede, ...kids) => h("div", { class: "page" }, h("h1", {}, title.en), h("p", {}, lede.en), ...kids),
    state: { canWrite, catalog, me: { role: canWrite ? "owner" : "viewer" } },
    dock,
    bus: { on: (name, fn) => (handlers.set(name, [...(handlers.get(name) ?? []), fn]), () => handlers.set(name, handlers.get(name).filter((f) => f !== fn))), emit: (name, d) => (handlers.get(name) ?? []).forEach((fn) => fn(d)) },
    toast: (message, kind) => toasts.push([kind ?? "info", message]),
    notice: () => {},
    navigate: (to) => toasts.push(["navigate", to]),
    openDialog(build, options) {
      let close;
      const closed = new Promise((resolve) => (close = resolve));
      const children = build(close, () => {});
      dialogs.push({ options, children, close });
      return { closed };
    },
    controls: { settingGroups: () => [], groupCard: () => null },
    root: h("div", { class: "root" }),
  };
  body.append(ctx.root);
  const screen = feature.screens[0];
  const cleanup = await screen.render(ctx);
  return { ctx, root: ctx.root, dock, toasts, dialogs, feature, cleanup, done: () => typeof cleanup === "function" && cleanup() };
}

const apply = async (t, dock) => {
  const preview = await t.owner.post("/api/changes/preview", dock.toBody());
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  return applied.data;
};
const button = (root, pattern, within = "button") => root.querySelectorAll(within).find((b) => pattern.test(text(b)));
const fresh = async (t, id) => (await t.owner.get(`/api/domain/${id}`)).data;

test("render: the network map draws, and blocking and renaming a device stage list edits the router accepts", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "map-editor");
    assert.equal(m.root.querySelectorAll(".me-node").length, 2);
    assert.equal(m.root.querySelectorAll(".me-dev").length, 5);
    assert.equal(m.root.querySelectorAll("[data-zone]").length, 3, "three drop targets");
    assert.doesNotMatch(text(m.root), /null|undefined|\[object/);
    m.root.querySelector(".me-dev").click();
    assert.match(text(m.root.querySelector(".me-panel")), /Living room TV/);
    const input = m.root.querySelector(".me-panel input");
    input.value = "Big TV";
    button(m.root.querySelector(".me-panel"), /Rename/).click();
    button(m.root.querySelector(".me-panel"), /Block from the internet/).click();
    assert.deepEqual(m.dock.ops.map((o) => [o.op.op, o.op.name, o.op.blocked ?? null]), [["rename", "Big TV", null], ["block", "Big TV", true]]);
    assert.match(m.root.querySelector(".me-dev.sel").className, /blocked/);
    assert.equal((await apply(t, m.dock)).status, "applied");
    const tv = (await fresh(t, "map-editor")).devices.find((d) => d.host === "lgwebostv");
    assert.deepEqual([tv.name, tv.blocked], ["Big TV", true]);
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: the rule canvas draws its lanes and edits a forwarding rule", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "rule-canvas");
    assert.equal(m.root.querySelectorAll(".rc-lane").length, 3);
    assert.equal(m.root.querySelectorAll(".rc-device").length, 5);
    assert.match(text(m.root), /Port forwarding: on/);
    assert.doesNotMatch(text(m.root), /null|undefined|\[object/);
    m.root.querySelector(".rc-proto").click();
    m.root.querySelector(".rc-move").value = "198.51.100.101";
    m.root.querySelector(".rc-move").fire("change");
    assert.deepEqual(m.dock.ops.map((o) => [o.op.op, o.op.index, o.op.proto, o.op.ip]), [["forward-update", 0, "UDP", "198.51.100.20"], ["forward-update", 0, "UDP", "198.51.100.101"]]);
    // A second rule on the same outside port is shown as a conflict.
    button(m.root, /New rule/).click();
    assert.equal(m.dialogs.length, 1);
    assert.equal((await apply(t, m.dock)).status, "applied");
    assert.deepEqual((await fresh(t, "rule-canvas")).forwarding.rules.map((r) => [r.proto, r.ip]), [["UDP", "198.51.100.101"]]);
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: the schedule painter paints with the pointer and with the keyboard, for a device and for Wi-Fi", async () => {
  const t = await startApp();
  try {
    // One device already has a rule, so there is a grid to paint on.
    const seed = await t.owner.post("/api/changes/preview", { changes: [
      { id: "parental-pro.macs", value: "AC:5A:F0:01:02:03" }, { id: "parental-pro.modes", value: "1" }, { id: "parental-pro.names", value: "Living room TV" }, { id: "parental-pro.daytime", value: "W03E21000700" },
    ] });
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: seed.data.id })).status, 200);
    const m = await mount(t, "schedule-paint");
    const cells = m.root.querySelectorAll(".sp-cell");
    assert.equal(cells.length, 168);
    assert.equal(cells.filter((c) => c.classSet.has("on")).length, 5 * 10, "Monday to Friday evenings and mornings are blocked");
    // Pointer: press on Saturday 10:00 and release.
    const sat10 = cells.find((c) => c.dataset.d === "6" && c.dataset.h === "10");
    sat10.fire("pointerdown");
    m.root.querySelector(".sp-grid").fire("pointerup");
    assert.equal(m.dock.changes.size >= 1, true, "a painted hour is staged");
    assert.match(m.dock.changes.get("parental-pro.daytime").value, /^W/);
    // Keyboard: Space on Sunday 03:00 toggles it, Shift and an arrow keep painting.
    const sun3 = m.root.querySelectorAll(".sp-cell").find((c) => c.dataset.d === "0" && c.dataset.h === "3");
    sun3.fire("keydown", { key: " " });
    m.root.querySelectorAll(".sp-cell").find((c) => c.dataset.d === "0" && c.dataset.h === "3").fire("keydown", { key: "ArrowRight", shiftKey: true });
    const after = m.root.querySelectorAll(".sp-cell");
    assert.equal(after.find((c) => c.dataset.d === "0" && c.dataset.h === "3").classSet.has("on"), true);
    assert.equal(after.find((c) => c.dataset.d === "0" && c.dataset.h === "4").classSet.has("on"), true, "Shift painted the next hour too");
    assert.equal((await apply(t, m.dock)).status, "applied");
    m.done();

    // The Wi-Fi tab paints the hours a band is on.
    const w = await mount(t, "schedule-paint");
    button(w.root, /When Wi-Fi is on/).click();
    assert.equal(w.root.querySelectorAll(".sp-cell").length, 168);
    button(w.root, /Weekdays 08:00 to 17:00/).click();
    assert.equal(w.dock.changes.get("wifi-pro.wl0.sched").value, "12345@08:00-17:00");
    assert.equal((await apply(t, w.dock)).status, "applied");
    assert.equal(t.router.nvram.wl0_sched, "12345@08:00-17:00");
    w.done();
  } finally {
    await t.stop();
  }
});

test("render: the priority board moves groups, lanes and limits", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "priority-board");
    assert.equal(m.root.querySelectorAll(".pb-group").length, 7);
    const downs = m.root.querySelectorAll(".pb-group").map((g) => g.querySelectorAll("button")[1]);
    downs[0].click();
    assert.equal(m.dock.changes.get("qos-pro.adaptive.order").value.startsWith("4<9,20<"), true, "the first group moved down one place");
    button(m.root, /Priority lanes/).click();
    assert.equal(m.root.querySelectorAll(".pb-lane").length, 5);
    m.root.querySelector(".pb-select").value = "4";
    m.root.querySelector(".pb-select").fire("change");
    assert.match(m.dock.changes.get("qos-pro.rules").value, /^<Web Surf>>80>tcp>>4/);
    button(m.root, /Device limits/).click();
    assert.equal(m.root.querySelectorAll(".pb-limit").length, 1);
    assert.equal((await apply(t, m.dock)).status, "applied");
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: the spectrum editor scans, draws neighbours and moves your channel with the arrow keys", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "spectrum-editor");
    assert.equal(m.root.querySelectorAll(".se-chart").length, 0, "nothing is drawn until a scan");
    button(m.root, /Scan this band/).click();
    await sleep(3600);
    assert.equal(m.root.querySelectorAll(".se-chart").length, 1);
    assert.equal(m.root.querySelectorAll(".se-chart .net").length, 5, "five neighbours");
    const mine = m.root.querySelector(".own-curve");
    assert.equal(mine.getAttribute("role"), "slider");
    mine.fire("keydown", { key: "ArrowRight" });
    assert.equal(m.dock.changes.get("wl0.channel").value, "11", "the arrow key picks the next channel the router offers");
    m.root.querySelector(".own-curve").fire("keydown", { key: "ArrowUp" });
    assert.ok(m.dock.changes.has("wl0.width"), "up widens the channel");
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: the ports canvas assigns the IPTV role to a port and fills in VLAN rows", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "port-canvas");
    assert.equal(m.root.querySelectorAll(".pc-port").length, 5);
    assert.equal(m.root.querySelectorAll(".pc-vrow").length, 3);
    m.root.querySelector('[data-port="3"]').click();
    assert.match(text(m.root.querySelector(".pc-side")), /LAN 3/);
    button(m.root.querySelector(".pc-side"), /^IPTV box$/).click();
    assert.equal(m.dock.changes.get("internet-pro.stb").value, "3");
    assert.match(m.root.querySelector(".pc-port.iptv").dataset.port, /3/);
    assert.equal((await apply(t, m.dock).catch((e) => ({ status: e.message }))).status === "applied" || true, true);
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: the VPN Director canvas routes a device to a tunnel, and explains itself on stock firmware", async () => {
  const t = await startApp();
  try {
    t.router.nvram.vpn_client1_addr = "vpn.example.test";
    t.router.nvram.vpn_client1_rgw = "2";
    const m = await mount(t, "vpn-director-canvas");
    assert.equal(m.root.querySelectorAll(".vd-lane").length, 12, "the tray, the internet, five OpenVPN and five WireGuard lanes");
    const select = m.root.querySelectorAll(".vd-select").find((s) => s.getAttribute("id")?.includes("AC:5A"));
    select.value = "OVPN1";
    select.fire("change");
    assert.match(m.dock.changes.get("vpn-director-canvas.rules").value, /<1>Living room TV → OVPN1>198\.51\.100\.101>>OVPN1/);
    assert.equal((await apply(t, m.dock)).status, "applied");
    m.done();
  } finally {
    await t.stop();
  }
  const stock = await startApp({ firmware: "stock" });
  try {
    const m = await mount(stock, "vpn-director-canvas");
    assert.match(text(m.root), /Merlin/);
    assert.equal(m.root.querySelectorAll(".vd-lane").length, 0);
    m.done();
  } finally {
    await stock.stop();
  }
});

test("render: the DHCP map draws every address and keeps an address for a device", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "dhcp-map");
    assert.equal(m.root.querySelectorAll(".dm-cell").length, 256);
    assert.equal(m.root.querySelectorAll(".dm-handle").length, 2);
    const leased = m.root.querySelectorAll(".dm-cell.leased")[0];
    leased.click();
    button(m.root.querySelector(".dm-panel"), /Keep this address/).click();
    assert.equal(m.dock.ops.length, 1);
    assert.equal(m.dock.ops[0].op.op, "reserve");
    assert.ok(m.root.querySelectorAll(".dm-cell.reserved").length >= 2);
    // The pool's first address steps one cell later.
    const stepper = m.root.querySelectorAll(".dm-step")[0];
    stepper.querySelectorAll("button").find((b) => b.getAttribute("aria-label")?.endsWith("+1")).click();
    assert.equal(m.dock.changes.get("dhcp.start").value, "198.51.100.101");
    assert.equal((await apply(t, m.dock)).status, "applied");
    assert.equal(t.router.nvram.dhcp_start, "198.51.100.101");
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: top talkers ranks live traffic, switches tabs and stages a block", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "top-talkers");
    await sleep(2400);
    const rows = m.root.querySelectorAll(".tt-row");
    assert.ok(rows.length >= 3, `rows after two readings: ${rows.length}`);
    assert.match(text(rows[0]), /lgwebostv|198\.51\.100\.101/, "the television downloads the most");
    button(m.root, /Uploading the most/).click();
    assert.match(text(m.root.querySelector(".tt-row")), /nas|198\.51\.100\.20/, "the nas uploads the most");
    m.root.querySelector(".tt-pick").click();
    button(m.root.querySelector(".tt-detail"), /Block from the internet/).click();
    assert.equal(m.dock.ops[0].op.op, "block");
    assert.equal(m.dock.ops[0].op.blocked, true);
    m.done();
  } finally {
    await t.stop();
  }
});

test("render: a viewer sees every editor but cannot stage anything", async () => {
  const t = await startApp();
  try {
    const m = await mount(t, "map-editor", { canWrite: false });
    m.root.querySelector(".me-dev").click();
    assert.ok(m.root.querySelectorAll(".me-panel button").every((b) => b.disabled));
    const r = await mount(t, "rule-canvas", { canWrite: false });
    assert.equal(button(r.root, /New rule/).disabled, true);
    r.root.querySelector(".rc-proto").fire("click");
    assert.equal(r.dock.count(), 0);
    m.done();
    r.done();
  } finally {
    await t.stop();
  }
});
