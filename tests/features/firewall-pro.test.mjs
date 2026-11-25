// Tests for the firewall-pro feature: every setting reads the router's value
// and can be previewed, applied, read back and undone through the change
// engine; the rule-table, weekdays and timerange controls refuse bad values;
// the address test route; and the browser module.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/firewall-pro/index.js";
import { cellProblem, formatRows, parseRows } from "../../public/js/features/firewall-pro/rule-table.js";
import { activeGrid, windowHours } from "../../public/js/features/firewall-pro/time-controls.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { maskedByApp } from "../../server/features/firewall-pro/index.mjs";
import { ruleTable, validIpv6 } from "../../server/features/firewall-pro/table.mjs";
import { isSecretKey } from "../../server/router/secrets.mjs";
import { startApp, waitFor } from "../helpers.mjs";

async function settle(t, record) {
  if (record.status !== "guarded" && record.status !== "applying") return record;
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
}

// Previews and applies one change, waits for it to finish, returns the record.
async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied", JSON.stringify(record));
  return record;
}

async function undo(t, record) {
  const preview = await t.owner.post(`/api/changes/${record.id}/undo`);
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal((await settle(t, applied.data)).status, "applied");
}

const entryOf = async (t, id) => (await t.owner.get("/api/catalog")).data.entries.find((e) => e.id === id);

test("firewall-pro: every entry reads its router value, and the controls are the rich ones", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data;
    assert.ok(catalog.domains.some((d) => d.id === "firewall-pro" && d.supported));
    const mine = catalog.entries.filter((e) => e.feature === "firewall-pro");
    assert.deepEqual(mine.map((e) => [e.id, e.control]), [
      ["firewall-pro.log", "select"],
      ["firewall-pro.url.enable", "switch"],
      ["firewall-pro.url.list", "rule-table"],
      ["firewall-pro.url.days", "weekdays"],
      ["firewall-pro.url.time", "timerange"],
      ["firewall-pro.keyword.enable", "switch"],
      ["firewall-pro.keyword.list", "rule-table"],
      ["firewall-pro.keyword.days", "weekdays"],
      ["firewall-pro.keyword.time", "timerange"],
      ["firewall-pro.services.enable", "switch"],
      ["firewall-pro.services.default", "segmented"],
      ["firewall-pro.services.icmp", "chips"],
      ["firewall-pro.services.rules", "rule-table"],
      ["firewall-pro.services.days", "weekdays"],
      ["firewall-pro.services.time", "timerange"],
      ["firewall-pro.services.time2", "timerange"],
      ["firewall-pro.ipv6.rules", "rule-table"],
    ]);
    // The feature's copy of the app's secret-name pattern must match the real one.
    // If this fails, secrets.mjs changed: update MASKED in firewall-pro/index.mjs, and when
    // keyword_* is no longer masked the four keyword entries become normal writable entries.
    for (const e of mine) assert.equal(maskedByApp(e.key), isSecretKey(e.key), `${e.key}: the mask mirror is out of date`);
    for (const e of mine) {
      if (maskedByApp(e.key)) assert.deepEqual([e.secret, e.value, e.readOnly], [true, "", true], `${e.id} is masked by the app, so it is read-only`);
      else assert.equal(e.value, t.router.nvram[e.key], `${e.id} shows the router's value`);
    }
    assert.equal(mine.some((e) => e.control === "text"), false, "no bare text box");
    // The four stock firewall switches stay with the stock catalogue.
    for (const key of ["fw_enable_x", "misc_ping_x", "fw_dos_x", "ipv6_fw_enable"]) assert.equal(mine.some((e) => e.key === key), false);
  } finally {
    await t.stop();
  }
});

test("firewall-pro: the switches, log type, schedules and lists preview, apply, read back and undo", async () => {
  const t = await startApp();
  try {
    const cases = [
      ["firewall-pro.log", "both"],
      ["firewall-pro.url.enable", "1"],
      ["firewall-pro.url.list", "<ads.example.test<tracker.example.test<news.example.test"],
      ["firewall-pro.url.days", "0111110"],
      ["firewall-pro.url.time", "08001700"],
      ["firewall-pro.services.default", "ACCEPT"],
      ["firewall-pro.services.icmp", "echo-request echo-reply"],
      ["firewall-pro.services.rules", "<198.51.100.104>>203.0.113.9>25>TCP<>>203.0.113.20>8000:8010>UDP"],
      ["firewall-pro.services.time2", "18002200"],
      ["firewall-pro.ipv6.rules", "<Web server>>2001:db8:1::5>443>TCP<SSH>2001:db8:ffff::1>2001:db8:1::6>22>TCP"],
    ];
    for (const [id, value] of cases) {
      const before = await entryOf(t, id);
      const record = await change(t, [{ id, value }]);
      assert.equal(t.router.nvram[before.key], value, `${id}: the router has the new value`);
      assert.equal(t.router.committed[before.key], value, `${id}: committed`);
      assert.equal((await entryOf(t, id)).value, value, `${id}: the browser reads it back`);
      assert.deepEqual(t.router.services.includes("restart_firewall"), true);
      await undo(t, record);
      assert.equal(t.router.nvram[before.key], before.value, `${id}: undo restores ${before.key}`);
    }
  } finally {
    await t.stop();
  }
});

test("firewall-pro: refuses lists and schedules the router could not understand", async () => {
  const t = await startApp();
  try {
    const refuse = async (id, value) => assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} should refuse ${value}`);
    await refuse("firewall-pro.url.list", "ads.example.test"); // not in the router's format
    await refuse("firewall-pro.url.list", "<a b.example.test"); // a space is not allowed
    await refuse("firewall-pro.url.list", "<dup.example.test<DUP.example.test"); // repeated
    await refuse("firewall-pro.services.rules", "<198.51.100.1>80"); // too few fields
    await refuse("firewall-pro.services.rules", "<999.1.1.1>>>>TCP"); // bad address
    await refuse("firewall-pro.services.rules", "<198.51.100.1>70000>>>TCP"); // bad port
    await refuse("firewall-pro.services.rules", "<>>>>ICMP"); // not a listed protocol
    await refuse("firewall-pro.ipv6.rules", "<Web>>not-ipv6>443>TCP");
    await refuse("firewall-pro.ipv6.rules", "<Web>>2001:db8::1>443>TCP>extra");
    await refuse("firewall-pro.url.days", "11111");
    await refuse("firewall-pro.url.time", "17000800"); // ends before it starts
    await refuse("firewall-pro.url.time", "08002500");
    await refuse("firewall-pro.services.icmp", "echo-request ping-of-death");
    await refuse("firewall-pro.log", "everything");
    const tooMany = formatRows(Array.from({ length: 65 }, (_, i) => [`site${i}.example.test`]));
    await refuse("firewall-pro.url.list", tooMany);
  } finally {
    await t.stop();
  }
});

test("firewall-pro: the rule-table, weekdays and timerange controls check and normalise values", () => {
  const entry = { control: "rule-table", columns: [{ id: "a", cell: "text", label: { en: "A" } }, { id: "p", cell: "port", label: { en: "Port" }, optional: true }, { id: "d", cell: "device", label: { en: "Device" }, optional: true }], maxItems: 2, unique: true };
  const fail = (text) => { throw new Error(text); };
  assert.equal(ruleTable.validate(entry, "", fail), "");
  assert.equal(ruleTable.validate(entry, "<x>>aa:bb:cc:dd:ee:ff<y>8080>198.51.100.5", fail), "<x>>AA:BB:CC:DD:EE:FF<y>8080>198.51.100.5");
  assert.throws(() => ruleTable.validate(entry, "<x>><X>>", fail), /repeated/);
  assert.throws(() => ruleTable.validate(entry, "<a<b<c", fail), /at most 2/);
  assert.throws(() => ruleTable.validate(entry, "<x>9>bad", fail), /device/i);
  assert.match(ruleTable.sample(entry, ""), /^<sample1/);
  assert.notEqual(ruleTable.sample(entry, "<sample1>8080>198.51.100.120"), "<sample1>8080>198.51.100.120");
  assert.equal(ruleTable.validate(entry, ruleTable.sample(entry, ""), fail) !== undefined, true);

  assert.equal(validIpv6("2001:db8::10"), true);
  assert.equal(validIpv6("2001:db8::10/64"), true);
  assert.equal(validIpv6("2001:db8:0:0:0:0:0:1"), true);
  assert.equal(validIpv6("::1"), true);
  for (const bad of ["2001:db8", "2001::db8::1", "12345::1", "2001:db8::1/129", "198.51.100.1", ":::", "2001:db8::g"]) assert.equal(validIpv6(bad), false, bad);
});

test("firewall-pro: the address test route says which filter blocks an address", async () => {
  const t = await startApp();
  try {
    const ask = (url) => t.owner.get(`/api/x/firewall-pro/test-url?url=${encodeURIComponent(url)}`);
    // Both filters start off, so nothing is blocked yet.
    assert.equal((await ask("www.ads.example.test/banner")).data.blocked, false);
    await change(t, [{ id: "firewall-pro.url.enable", value: "1" }]);
    t.router.nvram.keyword_enable_x = "1"; // the keyword entries are read-only while the app masks them (see below)
    const site = (await ask("https://www.ads.example.test/banner")).data;
    assert.deepEqual([site.blocked, site.byUrlFilter, site.matchedSite], [true, true, "ads.example.test"]);
    const word = (await ask("shop.example.test/gambling-tips")).data;
    assert.deepEqual([word.blocked, word.byKeywordFilter, word.matchedKeyword], [true, true, "gambling"]);
    assert.equal((await ask("shop.example.test/tea")).data.blocked, false);
    assert.equal((await ask("")).status, 400);
    assert.equal((await ask("a b")).status, 400);

    const viewer = await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/x/firewall-pro/test-url?url=a.example.test")).status, 200, "viewers may read");
    assert.equal((await t.client().get("/api/x/firewall-pro/test-url?url=a.example.test")).status, 401, "sign-in is needed");
  } finally {
    await t.stop();
  }
});

test("firewall-pro: the screen data gathers the stock switches, the entries and a summary", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/firewall-pro")).data;
    assert.deepEqual(data.stock.map((e) => e.id), ["fw.enabled", "fw.ping", "fw.dos", "fw.ipv6"]);
    assert.equal(data.entries.length, 17);
    assert.deepEqual(data.summary.url, { enabled: false, rules: 2 });
    assert.deepEqual(data.summary.services, { enabled: false, rules: 1, fallback: "DROP" });
    assert.equal(data.summary.ipv6.rules, 1);
    await change(t, [{ id: "firewall-pro.url.enable", value: "1" }]);
    assert.equal((await t.owner.get("/api/domain/firewall-pro")).data.summary.url.enabled, true);
  } finally {
    await t.stop();
  }
});

test("firewall-pro: the browser module is well formed and its helpers are right", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/firewall-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/firewall-pro/style.css"));
    for (const file of ["index.js", "rule-table.js", "time-controls.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/firewall-pro/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "firewall-pro"), null);
  assert.deepEqual(Object.keys(feature.controls).sort(), ["rule-table", "timerange", "weekdays"]);
  assert.equal(feature.screens[0].id, "firewall-pro");
  assert.equal(feature.commands[0].id, "firewall-pro.open");

  assert.deepEqual(parseRows("<a>b<c>d"), [["a", "b"], ["c", "d"]]);
  assert.equal(formatRows(parseRows("<a>>c")), "<a>>c");
  const ctx = { t: (en) => en };
  assert.equal(cellProblem({ cell: "ipv4" }, "198.51.100.5", ctx), "");
  assert.notEqual(cellProblem({ cell: "ipv4" }, "198.51.100", ctx), "");
  assert.equal(cellProblem({ cell: "port", optional: true }, "", ctx), "");
  assert.equal(cellProblem({ cell: "port" }, "8000:8010", ctx), "");
  assert.notEqual(cellProblem({ cell: "port" }, "9000:8000", ctx), "");
  assert.equal(cellProblem({ cell: "device" }, "AA:BB:CC:DD:EE:FF", ctx), "");
  assert.notEqual(cellProblem({ cell: "kbps", max: 100 }, "101", ctx), "");

  const hours = windowHours("08001700");
  assert.deepEqual([hours.indexOf(true), hours.lastIndexOf(true), hours.filter(Boolean).length], [8, 16, 9]);
  assert.equal(windowHours("garbage").some(Boolean), false);
  const grid = activeGrid("0111110", ["08001700", "20002200"]);
  assert.equal(grid[0].some(Boolean), false, "Sunday is off");
  assert.equal(grid[1].filter(Boolean).length, 11, "Monday: nine plus two hours");
  assert.equal(grid.flat().filter(Boolean).length, 55);
});
