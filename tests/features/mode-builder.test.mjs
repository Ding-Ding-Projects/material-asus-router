// The mode builder: custom modes are made of real catalogue settings, refused when
// they contradict themselves or use a setting the router does not have, and once
// saved they behave exactly like the ready-made modes (preview, apply, undo).
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/mode-builder/index.js";
import { canEdit, itemControl } from "../../public/js/features/mode-builder/item-control.js";
import { contradictions } from "../../server/features/mode-builder/index.mjs";
import { startApp, waitFor } from "../helpers.mjs";

beforeEach(async () => {
  process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-builder-"));
});

const save = (t, body) => t.owner.post("/api/x/mode-builder/modes", body);
const movie = { name: "Movie night", icon: "movie", items: [{ id: "qos.enabled", value: "1" }, { id: "routing.upnp", value: "0" }, { id: "sys.led", value: "1" }] };

test("mode-builder: a mode is saved with its settings and appears with the ready-made ones", async () => {
  const t = await startApp();
  try {
    const empty = (await t.owner.get("/api/x/mode-builder/modes")).data;
    assert.deepEqual(empty.modes, []);
    assert.ok(empty.icons.includes("movie") && empty.icons.includes("star"));

    const made = await save(t, movie);
    assert.equal(made.status, 200, made.text);
    assert.match(made.data.id, /^custom-/);
    assert.equal(t.router.nvram.qos_enable, "0", "saving a mode writes nothing to the router");

    const modes = (await t.owner.get("/api/x/modes/list")).data.modes;
    assert.equal(modes.length, 8);
    const custom = modes.at(-1);
    assert.deepEqual([custom.id, custom.custom, custom.name.en, custom.icon, custom.active], [made.data.id, true, "Movie night", "movie", false]);
    assert.deepEqual(custom.items.map((i) => [i.id, i.now.en, i.to.en]), [["qos.enabled", "Off", "On"], ["routing.upnp", "On", "Off"], ["sys.led", "Off", "On"]]);

    // It goes through the change engine like any other mode, and undoes in one step.
    const previewed = await t.owner.post("/api/x/modes/preview", { id: custom.id, action: "apply" });
    assert.equal(previewed.status, 200, previewed.text);
    const applied = await t.owner.post("/api/changes/apply", { previewId: previewed.data.preview.id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal((await t.owner.post("/api/x/modes/confirm", { previewId: previewed.data.preview.id })).data.active, true);
    assert.deepEqual([t.router.nvram.qos_enable, t.router.nvram.upnp_enable, t.router.nvram.led_disable], ["1", "0", "1"]);
    assert.equal((await t.owner.get("/api/x/modes/list")).data.modes.at(-1).active, true);

    const undo = await t.owner.post("/api/x/modes/preview", { id: custom.id, action: "undo" });
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: undo.data.preview.id })).status, 200);
    await waitFor(async () => ((await t.owner.get("/api/x/modes/list")).data.modes.at(-1).active === false ? true : null));
    assert.deepEqual([t.router.nvram.qos_enable, t.router.nvram.upnp_enable, t.router.nvram.led_disable], ["0", "1", "0"]);

    // Editing replaces the mode; deleting removes it from both screens.
    const renamed = await save(t, { ...movie, id: made.data.id, name: "Cinema", items: movie.items.slice(0, 1) });
    assert.equal(renamed.data.id, made.data.id);
    assert.equal((await t.owner.get("/api/x/modes/list")).data.modes.at(-1).name.en, "Cinema");
    assert.equal((await t.owner.request("DELETE", `/api/x/mode-builder/modes/${made.data.id}`)).status, 200);
    assert.equal((await t.owner.get("/api/x/modes/list")).data.modes.length, 7);
    assert.equal((await t.owner.request("DELETE", `/api/x/mode-builder/modes/${made.data.id}`)).status, 404);
  } finally {
    await t.stop();
  }
});

test("mode-builder: a bad mode is refused with the reason, and nothing unreal can be put in one", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const refuse = async (body, status, pattern) => {
      const out = await save(t, body);
      assert.equal(out.status, status, out.text);
      assert.match(out.data.error ?? out.text, pattern);
    };
    await refuse({ ...movie, name: "" }, 400, /name/i);
    await refuse({ ...movie, name: "a<b" }, 400, /characters/);
    await refuse({ ...movie, icon: "skull" }, 400, /icon/);
    await refuse({ ...movie, items: [] }, 400, /at least one/);
    await refuse({ ...movie, items: [{ id: "qos.enabled", value: "1" }, { id: "qos.enabled", value: "0" }] }, 400, /twice/);
    await refuse({ ...movie, items: [{ id: "qos.enabled", value: "maybe" }] }, 400, /on or off/);
    await refuse({ ...movie, items: [{ id: "qos.up", value: "-4" }] }, 400, /whole number/);
    await refuse({ ...movie, items: [{ id: "wl0.password", value: "longenoughpassword" }] }, 400, /Passwords and keys/);
    await refuse({ ...movie, items: [{ id: "no.such.setting", value: "1" }] }, 400, /does not have/);
    await refuse({ ...movie, items: [{ id: "dns-pro.dot-enable", value: "1" }] }, 400, /Merlin/);
    await refuse({ ...movie, items: [{ id: "wl1.radio", value: "0" }, { id: "wl1.1.enabled", value: "1" }] }, 409, /contradicts itself/);
    await refuse({ ...movie, items: [{ id: "qos.enabled", value: "0" }, { id: "qos.type", value: "1" }] }, 409, /traffic priority off/);

    assert.equal((await save(t, movie)).status, 200);
    await refuse(movie, 409, /already has that name/);
    assert.equal((await save(t, { ...movie, id: "custom-nope" })).status, 404);

    // A setting that is in the catalogue but not in the router's own list is refused by name.
    delete t.router.nvram.led_disable;
    await refuse({ ...movie, name: "Other", items: [{ id: "sys.led", value: "1" }] }, 400, /This router does not have the setting led_disable/);

    const check = await t.owner.post("/api/x/mode-builder/check", { items: [{ id: "qos.enabled", value: "0" }, { id: "qos.type", value: "1" }] });
    assert.equal(check.data.ok, false);
    assert.equal((await t.owner.post("/api/x/mode-builder/check", { items: [{ id: "qos.enabled", value: "1" }] })).data.ok, true);

    const palette = (await t.owner.get("/api/x/mode-builder/palette")).data;
    assert.ok(palette.present.includes("qos.enabled"));
    assert.match(palette.refused["dns-pro.dot-enable"].en, /Merlin/);
    assert.ok(palette.refused["wl0.password"], "passwords are never offered");
    assert.ok(palette.refused["sys.led"], "a setting the router lacks is refused");
  } finally {
    await t.stop();
  }
});

test("mode-builder: a viewer can read but not save, and the limit is enforced", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/mode-builder/modes")).status, 401);
    assert.equal((await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" })).status, 201);
    const viewer = t.client();
    assert.equal((await viewer.signIn("vi", "viewer password 1")).status, 200);
    assert.equal((await viewer.get("/api/x/mode-builder/modes")).status, 200);
    assert.equal((await viewer.post("/api/x/mode-builder/modes", movie)).status, 403);

    for (let i = 0; i < 24; i += 1) assert.equal((await save(t, { ...movie, name: `Mode ${i}`, items: [{ id: "qos.enabled", value: "1" }] })).status, 200);
    assert.equal((await save(t, { ...movie, name: "One too many" })).status, 409);
  } finally {
    await t.stop();
  }
});

test("mode-builder: contradictions are found and the controls are real", () => {
  const byId = new Map([["a", { key: "wl0_radio" }], ["b", { key: "wl0.1_bss_enabled" }], ["c", { key: "wps_enable" }], ["d", { key: "wl1_wps_mode" }], ["e", { key: "dnspriv_enable" }], ["f", { key: "dnspriv_rulelist" }]]);
  assert.equal(contradictions([{ id: "a", value: "0" }, { id: "b", value: "1" }], byId).length, 1);
  assert.equal(contradictions([{ id: "a", value: "1" }, { id: "b", value: "1" }], byId).length, 0);
  assert.equal(contradictions([{ id: "c", value: "0" }, { id: "d", value: "enabled" }], byId).length, 1);
  assert.equal(contradictions([{ id: "e", value: "0" }, { id: "f", value: "<1.1.1.1>853>x.test>" }], byId).length, 1);

  assert.equal(canEdit({ control: "switch" }), true);
  assert.equal(canEdit({ control: "schedule" }), false, "the registered controls are only available once the app has loaded them");
  const calls = [];
  const h = (tag, props = {}, ...kids) => ({ tag, props, kids, setAttribute() {} });
  const ctx = { h, tt: (l) => l.en, t: (en) => en };
  const entry = { control: "switch", values: { on: "1", off: "0" }, label: { en: "Radio", yue: "無線電" } };
  let value = "0";
  const control = itemControl(ctx, entry, () => value, (v) => { value = v; calls.push(v); }, false);
  assert.equal(control.el.props.role, "switch");
  assert.equal(control.el.props["aria-checked"], "false");
  control.el.props.onClick();
  assert.deepEqual(calls, ["1"]);
  const fallback = itemControl(ctx, { control: "rule-table", label: entry.label }, () => "", () => {}, false);
  assert.match(JSON.stringify(fallback.el), /cannot be edited inside a mode yet/);
});

test("mode-builder: the manifest lists the browser module and it is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/mode-builder/index.js"));
    assert.ok(manifest.styles.includes("/js/features/mode-builder/style.css"));
    assert.ok(manifest.server.includes("mode-builder"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "mode-builder"), null);
});
