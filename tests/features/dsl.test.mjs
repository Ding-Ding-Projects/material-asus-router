// Tests for dsl: the line reading, the settings (DSL models only, typed
// confirmation), the retrain with its live timeline, and the helpers.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/dsl/index.js";
import { STEPS, createTimeline, dbText, gauge, kbpsText } from "../../public/js/features/dsl/model.js";
import { parseXdsl, verdict } from "../../server/features/dsl/parse.mjs";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

const dslApp = async (firmware = "stock") => {
  const t = await startApp({ firmware });
  t.router.nvram.rc_support += " dsl";
  return t;
};
const MODEL = "RT-AX86U";

async function settle(t, id) {
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
}

for (const firmware of ["stock", "merlin"]) {
  test(`dsl on ${firmware}: every setting reads, previews after the typed model, applies, reads back and undoes`, async () => {
    const t = await dslApp(firmware);
    try {
      const { entries, supported } = (await t.owner.get("/api/domain/dsl")).data;
      assert.equal(supported, true);
      assert.equal(entries.length, 7);
      const next = { "dsl.modulation": "5", "dsl.annex": "ANNEX B", "dsl.vdsl-profile": "2", "dsl.snr-offset": "-10", "dsl.sra": "0", "dsl.bitswap": "0", "dsl.ginp": "0" };
      for (const e of entries) {
        assert.equal(e.disabled, null);
        assert.equal(e.risk, "destructive");
        assert.equal(e.value, t.router.nvram[e.key], `${e.id} shows the router's value`);
        // The generic engine also writes it, and undo puts it back.
        const original = t.router.nvram[e.key];
        const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: e.id, value: next[e.id] }] });
        assert.equal(preview.status, 200, preview.text);
        const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
        const record = await settle(t, applied.data.id);
        assert.equal(record.status, "applied");
        assert.equal(t.router.committed[e.key], next[e.id]);
        assert.ok(t.router.services.includes("restart_dsl"));
        const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
        await settle(t, (await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data.id);
        assert.equal(t.router.nvram[e.key], original);
      }
    } finally {
      await t.stop();
    }
  });
}

test("dsl: the change route needs the router model typed exactly, and only DSL settings", async () => {
  const t = await dslApp();
  try {
    const body = { changes: [{ id: "dsl.sra", value: "0" }] };
    assert.equal((await t.owner.post("/api/x/dsl/change", { ...body, confirm: "wrong" })).status, 403);
    assert.equal((await t.owner.post("/api/x/dsl/change", body)).status, 403);
    assert.equal((await t.owner.post("/api/x/dsl/change", { changes: [{ id: "qos.enabled", value: "1" }], confirm: MODEL })).status, 400);
    assert.equal((await t.owner.post("/api/x/dsl/change", { changes: [], confirm: MODEL })).status, 400);
    const ok = await t.owner.post("/api/x/dsl/change", { ...body, confirm: MODEL });
    assert.equal(ok.status, 200, ok.text);
    assert.deepEqual(ok.data.items.map((i) => [i.key, i.old, i.new, i.risk]), [["dslx_sra", "1", "0", "destructive"]]);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: ok.data.id })).status, 200);
    assert.equal((await t.client().post("/api/x/dsl/change", { ...body, confirm: MODEL })).status, 401);
  } finally {
    await t.stop();
  }
});

test("dsl: wrong values are refused", async () => {
  const t = await dslApp();
  try {
    for (const [id, value] of [["dsl.modulation", "9"], ["dsl.annex", "ANNEX Z"], ["dsl.snr-offset", "101"], ["dsl.snr-offset", "-101"], ["dsl.sra", "2"], ["dsl.vdsl-profile", "7"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} ${value}`);
  } finally {
    await t.stop();
  }
});

test("dsl: a router without a DSL modem has nothing to read and refuses every change", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const d = (await t.owner.get("/api/domain/dsl")).data;
    assert.deepEqual([d.supported, d.line], [false, null]);
    assert.ok(d.entries.every((e) => e.disabled));
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "dsl.sra", value: "0" }] })).status, 400);
    assert.equal((await t.owner.get("/api/x/dsl/status")).status, 404);
    assert.equal((await t.owner.post("/api/x/dsl/change", { changes: [{ id: "dsl.sra", value: "0" }], confirm: MODEL })).status, 404);
    const catalog = (await t.owner.get("/api/catalog")).data;
    assert.equal(catalog.domains.find((x) => x.id === "dsl").supported, false);
  } finally {
    await t.stop();
  }
});

test("dsl: a setting the router does not list is switched off with the exact reason", async () => {
  const t = await dslApp();
  try {
    delete t.router.nvram.dslx_ginp;
    const e = (await t.owner.get("/api/domain/dsl")).data.entries.find((x) => x.key === "dslx_ginp");
    assert.equal(e.disabled.en, "This router does not have the setting dslx_ginp");
  } finally {
    await t.stop();
  }
});

test("dsl: the status reads the line, and retraining takes it down then back with the typed model and hold", async () => {
  const t = await dslApp();
  try {
    const first = (await t.owner.get("/api/x/dsl/status")).data;
    assert.deepEqual([first.line.state, first.line.mode, first.line.rate.down, first.line.snr.down], ["up", "ADSL2+ Annex A", 9964, 7.8]);
    assert.equal(first.verdict.id, "snr-ok");
    const refuse = await t.owner.post("/api/actions/dsl.retrain", { confirm: "wrong", hold: true });
    assert.equal(refuse.status, 403);
    assert.equal((await t.owner.post("/api/actions/dsl.retrain", { confirm: MODEL })).status, 403);
    const run = await t.owner.post("/api/actions/dsl.retrain", { confirm: MODEL, hold: true });
    assert.equal(run.status, 200, run.text);
    const seen = new Set();
    await waitFor(async () => {
      const now = (await t.owner.get("/api/x/dsl/status")).data.line.state;
      seen.add(now);
      return now === "up" && seen.size > 1 ? now : null;
    });
    assert.ok(seen.has("down") || seen.has("training"), `the line went down and came back: ${[...seen]}`);
    assert.equal((await t.client().get("/api/x/dsl/status")).status, 401);
  } finally {
    await t.stop();
  }
});

test("dsl: the reader understands the modem's report and judges the line in plain words", () => {
  const text = "Status: Showtime\nMax:\tUpstream rate = 1176 Kbps, Downstream rate = 15088 Kbps\nBearer:\t0, Upstream rate = 1020 Kbps, Downstream rate = 9964 Kbps\nMode:\t\t\tVDSL2 Annex B\nTraining Status:\tShowtime\nSNR (dB):\t 12.4\t\t 10.1\nAttn(dB):\t 20.0\t\t 9.0\nPwr(dBm):\t 5.0\t\t 6.0\n";
  const line = parseXdsl(text);
  assert.deepEqual([line.state, line.modulation, line.annex, line.rate, line.snr, line.attenuation], ["up", "VDSL2", "ANNEX B", { up: 1020, down: 9964 }, { down: 12.4, up: 10.1 }, { down: 20, up: 9 }]);
  assert.equal(verdict(line).id, "strong");
  assert.equal(verdict({ ...line, snr: { down: 4, up: 4 } }).id, "snr-low");
  assert.equal(verdict({ ...line, snr: { down: 7, up: 7 } }).id, "snr-ok");
  assert.equal(verdict({ ...line, state: "training" }).id, "training");
  assert.equal(verdict({ ...line, state: "down" }).id, "down");
  assert.equal(parseXdsl("Training Status:\tG.994 Training\n").state, "training");
  assert.equal(parseXdsl("Training Status:\tIdle\n").state, "down");
  assert.equal(parseXdsl("").state, "unknown");
  assert.equal(kbpsText(9964), "9.96 Mbit/s");
  assert.equal(kbpsText(640), "640 kbit/s");
  assert.equal(dbText(7.84), "7.8 dB");
  assert.equal(gauge(10), 0.5);
  assert.equal(gauge(99), 1);
  assert.equal(gauge(null), 0);
});

test("dsl: the timeline keeps going until the line is back and the settings read back", () => {
  const tl = createTimeline(1000, { graceMs: 5000 });
  const status = (steps) => steps.map((s) => s.status[0]).join("");
  assert.equal(status(tl.steps()), "dawww");
  assert.equal(status(tl.observe("up", 2000)), "dawww", "still in sync inside the grace time proves nothing");
  assert.equal(status(tl.observe("down", 3000)), "ddaww");
  assert.equal(status(tl.observe("training", 4000)), "dddaw");
  assert.equal(tl.finished, false);
  assert.equal(status(tl.observe("up", 5000)), "dddda");
  assert.equal(status(tl.confirmReadBack()), "ddddd");
  assert.equal(tl.finished, true);
  // A line that never dropped finishes after the grace time.
  const calm = createTimeline(0, { graceMs: 1000 });
  calm.observe("up", 500);
  assert.equal(calm.upAt, null);
  calm.observe("up", 1500);
  assert.equal(calm.upAt, 1500);
  assert.deepEqual(STEPS, ["sent", "down", "training", "up", "readback"]);
});

test("dsl: the module is well formed and the manifest lists it", async () => {
  assert.equal(checkFeatureModule(feature, "dsl"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/dsl/index.js"));
    assert.ok(manifest.styles.includes("/js/features/dsl/style.css"));
  } finally {
    await t.stop();
  }
});
