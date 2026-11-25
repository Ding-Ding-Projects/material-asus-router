import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMAINS } from "../server/router/catalog.mjs";
import { startApp } from "./helpers.mjs";

test("every screen can be read from a Merlin router", async () => {
  const t = await startApp();
  try {
    for (const domain of DOMAINS) {
      const res = await t.owner.get(`/api/domain/${domain.id}`);
      assert.equal(res.status, 200, `${domain.id}: ${res.text}`);
      assert.equal(res.data.id, domain.id);
    }
  } finally {
    await t.stop();
  }
});

test("overview shows uptime, memory, temperatures, the internet link and traffic rates", async () => {
  const t = await startApp();
  try {
    const first = (await t.owner.get("/api/domain/overview")).data;
    assert.ok(first.uptimeSeconds > 3 * 86400);
    assert.equal(first.memory.totalKb, 1018332);
    assert.ok(first.memory.usedPct > 0 && first.memory.usedPct < 100);
    assert.ok(first.cpuTempC >= 60 && first.cpuTempC <= 65);
    assert.deepEqual(first.radios.map((r) => r.tempC), [48, 53]);
    assert.equal(first.wan.connected, true);
    assert.equal(first.wan.ip, "100.64.12.34");
    assert.equal(first.load.length, 3);
    await new Promise((r) => setTimeout(r, 400));
    const second = (await t.owner.get("/api/domain/overview")).data;
    assert.ok(second.traffic.rxBitsPerSecond > 0, "a second sample produces a rate");
  } finally {
    await t.stop();
  }
});

test("devices combine leases, ARP, Wi-Fi association, names, reservations and blocks", async () => {
  const t = await startApp();
  try {
    const { devices, summary } = (await t.owner.get("/api/domain/devices")).data;
    assert.equal(summary.total, 5);
    const tv = devices.find((d) => d.mac === "AC:5A:F0:01:02:03");
    assert.equal(tv.name, "Living room TV");
    assert.equal(tv.iface, "wireless");
    assert.equal(tv.band, "5 GHz");
    assert.equal(tv.rssi, -48);
    const nas = devices.find((d) => d.hostname === "nas");
    assert.equal(nas.iface, "wired");
    assert.equal(nas.reservedIp, "198.51.100.20");
    assert.equal(devices.find((d) => d.mac === "DC:A6:32:44:55:66").band, "2.4 GHz");
    assert.ok(devices.every((d) => d.blocked === false));
  } finally {
    await t.stop();
  }
});

test("settings screens return labelled controls with values and hide secrets", async () => {
  const t = await startApp();
  try {
    const wifi = (await t.owner.get("/api/domain/wifi")).data;
    assert.equal(wifi.bands.length, 2);
    const ssid = wifi.entries.find((e) => e.id === "wl0.ssid");
    assert.equal(ssid.value, "Harbour Home");
    assert.equal(ssid.label.yue, "網絡名稱");
    const password = wifi.entries.find((e) => e.id === "wl0.password");
    assert.equal(password.value, "");
    assert.equal(password.masked, true);
    assert.ok(!JSON.stringify(wifi).includes("milk-tea-and-egg-tarts"));
    const lan = (await t.owner.get("/api/domain/lan")).data;
    assert.equal(lan.entries.find((e) => e.id === "lan.ip").value, "198.51.100.1");
    assert.deepEqual(lan.reservations, [{ mac: "B8:27:EB:11:22:33", ip: "198.51.100.20", dns: "", hostname: "nas" }]);
    const forwarding = (await t.owner.get("/api/domain/forwarding")).data;
    assert.deepEqual(forwarding.rules, [{ index: 0, name: "Game server", extPort: "25565", ip: "198.51.100.20", intPort: "25565", proto: "TCP", srcIp: "" }]);
    for (const id of ["internet", "firewall", "qos", "vpn", "system"]) {
      const res = (await t.owner.get(`/api/domain/${id}`)).data;
      assert.ok(res.entries.length > 0, id);
    }
    assert.equal((await t.owner.get("/api/domain/qos")).data.entries.find((e) => e.id === "qos.down").value, "300000");
  } finally {
    await t.stop();
  }
});

test("AiMesh, USB, logs, jobs, Merlin extras, maintenance and firmware read correctly", async () => {
  const t = await startApp();
  try {
    const mesh = (await t.owner.get("/api/domain/aimesh")).data;
    assert.equal(mesh.nodes.length, 2);
    assert.equal(mesh.nodes[1].role, "node");
    const usb = (await t.owner.get("/api/domain/usb")).data;
    assert.equal(usb.drives[0].manufacturer, "SanDisk");
    const logs = (await t.owner.get("/api/logs?lines=3")).data;
    assert.equal(logs.lines.length, 3);
    const jobs = (await t.owner.get("/api/domain/jobs")).data;
    assert.equal(jobs.supported, true);
    assert.deepEqual(jobs.jobs[0], { schedule: "0 4 * * *", command: "/jffs/scripts/backup.sh", id: "nightly-backup" });
    const merlin = (await t.owner.get("/api/domain/merlin")).data;
    assert.deepEqual(merlin.scripts, ["firewall-start", "services-start"]);
    assert.equal(merlin.entware, false);
    const maintenance = (await t.owner.get("/api/domain/maintenance")).data;
    assert.equal(maintenance.confirmPhrase, "RT-AX86U");
    assert.match((await t.owner.get("/api/domain/firmware")).data.version, /^3\.0\.0\.4/);
    assert.equal((await t.owner.get("/api/domain/tools")).data.tools.includes("ping"), true);
  } finally {
    await t.stop();
  }
});

test("Advanced lists every setting, labels known ones and masks secret-looking keys", async () => {
  const t = await startApp();
  try {
    const { rows, total } = (await t.owner.get("/api/domain/advanced")).data;
    assert.ok(total > 90 && rows.length === total);
    const ssid = rows.find((r) => r.key === "wl0_ssid");
    assert.equal(ssid.label.en, "Network name");
    assert.equal(ssid.value, "Harbour Home");
    for (const key of ["wl0_wpa_psk", "sshd_authkeys"]) {
      const row = rows.find((r) => r.key === key);
      assert.equal(row.value, "");
      assert.ok(row.masked || row.key === "sshd_authkeys");
    }
    assert.ok(!JSON.stringify(rows).includes("visitors-welcome"));
  } finally {
    await t.stop();
  }
});

test("the domain list marks Merlin-only screens unsupported on stock firmware", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const merlin = (await t.owner.get("/api/domain/merlin")).data;
    assert.equal(merlin.supported, false);
    assert.deepEqual(merlin.scripts, []);
    const entry = merlin.entries.find((e) => e.id === "merlin.scripts");
    assert.ok(entry.disabled);
  } finally {
    await t.stop();
  }
});
