// Router access: uploading the router's own private key at first start, and saving several
// routers (for example Main and Testing) and switching between them.
import assert from "node:assert/strict";
import { test } from "node:test";
import ssh2 from "ssh2";
import { FakeRouter } from "../server/ssh/fake-router.mjs";
import { startApp } from "./helpers.mjs";

const { utils } = ssh2;

test("the router's own private key can be uploaded and used to connect", async () => {
  const t = await startApp({ configure: false });
  try {
    const pair = utils.generateKeyPairSync("ed25519");
    t.router.nvram.sshd_authkeys = pair.public;

    const up = await t.owner.post("/api/router/key/upload", { privateKey: pair.private });
    assert.equal(up.status, 200, up.text);
    assert.equal(up.data.uploaded, true);
    assert.equal(up.data.publicKey.split(" ")[1], pair.public.split(" ")[1], "the public half shown matches the key");
    assert.ok(!(await t.owner.get("/api/router")).text.includes("PRIVATE KEY"), "the private key never leaves the vault");

    const first = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: "admin", authType: "key" });
    assert.equal(first.data.code, "HOST_KEY_UNKNOWN");
    const approved = await t.owner.post("/api/router/approve-host-key", { fingerprint: first.data.fingerprint, authType: "key" });
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.data.authType, "key");
    assert.equal((await t.owner.get("/api/domain/overview")).status, 200, "the app reads the router with the uploaded key");
    assert.equal((await t.owner.post("/api/router/key", {})).data.publicKey.split(" ")[1], pair.public.split(" ")[1], "asking for the key shows the uploaded one");
  } finally {
    await t.stop();
  }
});

test("uploading refuses a public key, junk and a key protected by a passphrase", async () => {
  const t = await startApp({ configure: false });
  try {
    const pair = utils.generateKeyPairSync("ed25519");
    const asPublic = await t.owner.post("/api/router/key/upload", { privateKey: pair.public });
    assert.equal(asPublic.status, 400);
    assert.match(asPublic.data.error, /public key/);
    assert.equal((await t.owner.post("/api/router/key/upload", { privateKey: "hello" })).status, 400);
    assert.equal((await t.owner.post("/api/router/key/upload", {})).status, 400);
    const locked = utils.generateKeyPairSync("ed25519", { passphrase: "secret words", cipher: "aes256-ctr", rounds: 16 });
    const refused = await t.owner.post("/api/router/key/upload", { privateKey: locked.private });
    assert.equal(refused.status, 400);
    assert.equal(refused.data.code, "KEY_ENCRYPTED");
    assert.equal((await t.owner.get("/api/router")).data.hasKey, false, "nothing was stored");
  } finally {
    await t.stop();
  }
});

test("routers can be saved as Main and Testing and switched, each with its own password", async () => {
  const t = await startApp();
  const testing = await new FakeRouter({ firmware: "stock", password: "testing-password" }).listen(0, "127.0.0.1");
  try {
    const main = await t.owner.post("/api/routers", { name: "Living room", role: "main" });
    assert.equal(main.status, 200, main.text);
    assert.deepEqual(main.data.routers.map((r) => [r.name, r.role, r.active]), [["Living room", "main", true]]);
    assert.deepEqual((await t.owner.get("/api/router")).data.active.name, "Living room");

    // Connect the testing router and save it.
    const body = { host: "127.0.0.1", port: testing.port, username: "admin", authType: "password", password: "testing-password" };
    const unknown = await t.owner.post("/api/router/connect", body);
    assert.equal(unknown.data.code, "HOST_KEY_UNKNOWN");
    assert.equal((await t.owner.post("/api/router/approve-host-key", { fingerprint: unknown.data.fingerprint })).status, 200);
    const saved = await t.owner.post("/api/routers", { name: "Testing", role: "testing" });
    assert.deepEqual(saved.data.routers.map((r) => [r.name, r.role, r.active]), [["Living room", "main", false], ["Testing", "testing", true]]);
    assert.equal((await t.owner.get("/api/router")).data.active.role, "testing");
    assert.equal((await t.owner.get("/api/catalog")).data.info.merlin, false, "the testing router is the one being read");

    // Back to the main router: its own password and host key are used.
    const id = saved.data.routers.find((r) => r.role === "main").id;
    const switched = await t.owner.post(`/api/routers/${id}/use`, {});
    assert.equal(switched.status, 200, switched.text);
    assert.equal(switched.data.active.name, "Living room");
    assert.equal((await t.owner.get("/api/catalog")).data.info.merlin, true);
    assert.equal(t.app.vault.get("router.password"), t.router.password);

    // Saving again renames instead of adding; removing forgets its password.
    assert.equal((await t.owner.post("/api/routers", { name: "Main router", role: "main" })).data.routers.length, 2);
    const testingId = saved.data.routers.find((r) => r.role === "testing").id;
    assert.equal((await t.owner.request("DELETE", `/api/routers/${testingId}`)).status, 200);
    assert.equal(t.app.vault.has(`routers.${testingId}.password`), false);
    assert.equal((await t.owner.post(`/api/routers/${testingId}/use`, {})).status, 404);
    assert.equal((await t.owner.post("/api/routers", { name: "", role: "main" })).status, 400);
  } finally {
    await testing.close();
    await t.stop();
  }
});

test("only the owner can upload a key or manage saved routers", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/users", { name: "helper", username: "helper", password: "a long enough password", role: "operator" })).status, 201);
    const op = t.client();
    await op.signIn("helper", "a long enough password");
    assert.equal((await op.post("/api/router/key/upload", { privateKey: "x" })).status, 403);
    assert.equal((await op.get("/api/routers")).status, 403);
    assert.equal((await op.post("/api/routers", { name: "Mine", role: "main" })).status, 403);
  } finally {
    await t.stop();
  }
});
