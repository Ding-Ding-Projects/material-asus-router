// Top talkers: the ranking is right, the four tabs work with mouse and keyboard, and the
// screen ranks the devices the router really reports (pretend router, real server).
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/top-talkers/index.js";
import { TABS, percent, rank, rateText, sizeText } from "../../public/js/features/top-talkers/rank.js";
import { document, install } from "../dom-stub.mjs";
import { startApp, waitFor } from "../helpers.mjs";

install();
const core = await import("../../public/js/core.js");

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

const devices = [
  { ip: "198.51.100.101", mac: "AA:AA:AA:AA:AA:01", name: "TV", down: 900, up: 10, totalDown: 5000, totalUp: 100 },
  { ip: "198.51.100.102", mac: "", name: "", down: 300, up: 700, totalDown: 9000, totalUp: 50 },
  { ip: "198.51.100.103", mac: "", name: "Idle", down: 0, up: 0, totalDown: 0, totalUp: 0 },
];

test("top-talkers: devices are ranked by the chosen number, biggest first, with shares and bars", () => {
  const down = rank(devices, "down", 10);
  assert.deepEqual(down.rows.map((r) => [r.rank, r.name, r.value]), [[1, "TV", 900], [2, "198.51.100.102", 300]], "a device that moves nothing is not ranked, and a missing name falls back to its address");
  assert.equal(down.sum, 1200);
  assert.equal(down.rows[0].fraction, 1);
  assert.equal(down.rows[1].share, 0.25);
  assert.deepEqual(rank(devices, "up", 10).rows.map((r) => r.name), ["198.51.100.102", "TV"]);
  assert.deepEqual(rank(devices, "totalDown", 1).rows.map((r) => r.name), ["198.51.100.102"]);
  assert.equal(rank(devices, "totalDown", 1).others, 1);
  assert.deepEqual(rank([], "down").rows, []);
  assert.equal(rank([{ ip: "198.51.100.9", name: "x", down: 5 }, { ip: "198.51.100.10", name: "y", down: 5 }], "down").rows[0].ip, "198.51.100.9", "ties are ordered by address");
  assert.deepEqual(TABS.map((t) => t.id), ["down", "up", "totalDown", "totalUp"]);
  assert.equal(rateText(1_250_000, "bits"), "10 Mbit/s");
  assert.equal(rateText(1_250_000, "bytes"), "1.25 MB/s");
  assert.equal(sizeText(2_500_000_000), "2.50 GB");
  assert.equal(sizeText(1_500_000), "1.5 MB");
  assert.equal(percent(0.256), "26%");
});

test("top-talkers: the screen ranks the pretend router's devices on four tabs, with the keyboard", async () => {
  const t = await startApp();
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (url, init = {}) => real(url.startsWith("/") ? t.base + url : url, { ...init, headers: { ...(init.headers ?? {}), Cookie: t.owner.cookie } });
    core.auth.csrf = t.owner.csrf;
    await t.owner.get("/api/x/device-traffic/sample"); // the first reading, so the screen's own reading can give speeds
    await new Promise((r) => setTimeout(r, 1000));
    const ctx = { api: core.api, t: core.t, tt: core.tt, h: core.h, icon: core.icon, clear: core.clear, toast: core.toast, navigate() {}, page: (title) => core.h("div", { class: "page" }, core.h("h1", {}, core.tt(title))) };
    const root = core.h("div", {});
    cleanups.push(await feature.screens[0].render({ ...ctx, root }));

    const tabs = root.all(".tt-tab");
    assert.deepEqual(tabs.map((b) => b.textContent.slice(b.all(".ms")[0].textContent.length)), ["Downloading now", "Uploading now", "Downloaded most", "Uploaded most"]);
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    const names = () => root.all(".tt-row").map((r) => r.all(".t1")[0].textContent);
    await waitFor(() => (root.all(".tt-row").length ? true : null));
    assert.equal(names()[0], "Living room TV", "the pretend router's heaviest downloader is first");
    assert.match(root.all(".tt-value")[0].textContent, /Mbit\/s/);
    assert.ok(root.all(".tt-bar").length === root.all(".tt-row").length);

    root.all(".tt-tab")[1].click();
    assert.equal(root.all(".tt-tab")[1].getAttribute("aria-selected"), "true");
    assert.equal(names()[0], "nas", "the pretend router's heaviest uploader leads the uploads tab");

    // Arrow keys move between tabs and wrap around.
    const first = root.all(".tt-tab")[3];
    first.fire("keydown", { key: "ArrowRight" });
    assert.equal(root.all(".tt-tab")[0].getAttribute("aria-selected"), "true");
    root.all(".tt-tab")[0].fire("keydown", { key: "End" });
    assert.equal(root.all(".tt-tab")[3].getAttribute("aria-selected"), "true");
    assert.match(root.all(".tt-value")[0].textContent, /kB|MB|GB/, "totals are shown as sizes");
    assert.ok(root.textContent.includes("Totals are the bytes of connections the router is tracking now"));

    const pause = root.all("button").find((b) => b.textContent.includes("Pause"));
    pause.click();
    assert.ok(root.all("button").some((b) => b.textContent.includes("Resume")));
    assert.equal(document.body.children.length, 0);
  } finally {
    globalThis.fetch = real;
    await t.stop();
  }
});

test("top-talkers: it needs a session, and the module is well formed and listed", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/device-traffic/sample")).status, 401);
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/top-talkers/index.js"));
    assert.ok(manifest.styles.includes("/js/features/top-talkers/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "top-talkers"), null);
});
