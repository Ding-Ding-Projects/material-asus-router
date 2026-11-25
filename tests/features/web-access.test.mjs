// Tests for web-access: the allowed-address control, certificate reading, the
// engine writes, the stock settings shown beside it, and the browser module.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { CONFIRM_WORD, allowedClient, certificateState, splitClients } from "../../public/js/features/web-access/index.js";
import { CLIENT_PATTERN, clientItems, isAllowedClient, parseCertificate, parseOpensslDate } from "../../server/features/web-access/cert.mjs";
import { startApp } from "../helpers.mjs";

test("web-access: openssl dates and certificates are read, with honest warning levels", () => {
  assert.equal(parseOpensslDate("Mar  1 12:00:00 2027 GMT"), Date.UTC(2027, 2, 1, 12, 0, 0));
  assert.equal(parseOpensslDate("not a date"), null);
  const text = "subject=CN = router.example.test\nissuer=C = US, O = Let's Encrypt, CN = R11\nnotAfter=Mar  1 12:00:00 2027 GMT\n";
  const day = Date.UTC(2027, 2, 1, 12, 0, 0);
  const at = (days) => parseCertificate(text, day - days * 86400000);
  assert.deepEqual([at(70).tone, at(20).tone, at(3).tone, at(-2).tone], ["fine", "soon", "urgent", "expired"]);
  assert.equal(at(70).daysLeft, 70);
  assert.equal(at(70).letsEncrypt, true);
  assert.equal(parseCertificate("subject=CN = x\nissuer=CN = x\nnotAfter=Mar  1 12:00:00 2027 GMT\n", day).selfSigned, true);
  assert.equal(parseCertificate("garbage").found, false);
});

test("web-access: the allowed-address rule refuses everyone-sized networks on both sides", () => {
  for (const ok of ["198.51.100.20", "198.51.100.0/24", "198.51.100.0/8"]) assert.equal(isAllowedClient(ok) && allowedClient(ok), true, ok);
  for (const no of ["0.0.0.0/0", "198.51.100.0/7", "999.1.1.1", "198.51.100.1/33", "a.b.c.d", "198.51.100.1<198.51.100.2"]) assert.equal(isAllowedClient(no) || allowedClient(no), false, no);
  const pattern = new RegExp(CLIENT_PATTERN);
  for (const item of ["198.51.100.20", "198.51.100.0/24", "198.51.100.0/8", "0.0.0.0/0", "198.51.100.0/7", "999.1.1.1", "198.51.100.1/33"]) assert.equal(pattern.test(item), isAllowedClient(item), `the pattern and the rule agree on ${item}`);
  assert.deepEqual(clientItems("<a<b"), ["a", "b"]);
  assert.deepEqual(splitClients(""), []);
});

test("web-access: certificate meter state follows days left", () => {
  assert.equal(certificateState({ found: true, daysLeft: 90, tone: "fine" }).share, 1);
  assert.deepEqual([certificateState({ found: true, daysLeft: 20, tone: "soon" }).tone, certificateState({ found: true, daysLeft: 2, tone: "urgent" }).tone], ["warn", "bad"]);
  assert.equal(certificateState({ found: false }).word, "unknown");
});

test("web-access: settings are real controls and the address list keeps its exact format", async () => {
  const t = await startApp();
  try {
    const mine = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "web-access");
    assert.deepEqual(mine.map((e) => e.id).sort(), ["web-access.autologout", "web-access.clientlist", "web-access.le.domain", "web-access.le.enable", "web-access.le.staging", "web-access.wan.port"]);
    assert.equal(mine.find((e) => e.id.endsWith("clientlist")).control, "clientlist");

    const domain = (await t.owner.get("/api/domain/web-access")).data;
    assert.equal(domain.internet.open, false, "the page is closed to the internet by default");
    assert.deepEqual(domain.related.map((e) => e.id).sort(), ["sys.remoteweb", "sys.webport", "system-pro.https.mode", "system-pro.https.port", "system-pro.remote.port", "system-pro.remote.restrict"]);
    assert.equal(domain.protocol, "2");

    const apply = async (changes) => {
      const preview = await t.owner.post("/api/changes/preview", { changes });
      assert.equal(preview.status, 200, preview.text);
      assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    };
    await apply([{ id: "web-access.clientlist", value: "<198.51.100.20<198.51.100.0/24" }, { id: "web-access.autologout", value: "15" }]);
    assert.equal(t.router.nvram.http_clientlist, "<198.51.100.20<198.51.100.0/24");
    assert.equal(t.router.nvram.http_autologout, "15");
    for (const value of ["198.51.100.20", "<0.0.0.0/0", "<198.51.100.20<198.51.100.20", "<999.1.1.1"])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "web-access.clientlist", value }] })).status, 400, value);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "web-access.autologout", value: "9999" }] })).status, 400);

    // The allow route builds a reviewed preview and never writes by itself.
    const before = t.router.nvram.http_clientlist;
    const allow = await t.owner.post("/api/x/web-access/allow", { address: "198.51.100.77" });
    assert.equal(allow.status, 200, allow.text);
    assert.equal(t.router.nvram.http_clientlist, before);
    assert.equal((await t.owner.post("/api/x/web-access/allow", { address: "198.51.100.20" })).status, 409);
    assert.equal((await t.owner.post("/api/x/web-access/allow", { address: "198.51.100.0/24" })).status, 400);
  } finally {
    await t.stop();
  }
});

test("web-access: the certificate read-out works, and a router without the settings locks them", async () => {
  const t = await startApp();
  try {
    const cert = (await t.owner.get("/api/x/web-access/certificate")).data;
    assert.deepEqual([cert.found, cert.letsEncrypt, cert.tone], [true, true, "fine"]);
    assert.ok(cert.daysLeft >= 68 && cert.daysLeft <= 70, `daysLeft was ${cert.daysLeft}`);
    delete t.router.nvram.le_domain;
    t.app.session.invalidate();
    const entries = (await t.owner.get("/api/domain/web-access")).data.entries;
    assert.equal(entries.find((e) => e.key === "le_domain").disabled.en, "This router does not have the setting le_domain");
    const guest = t.client();
    assert.equal((await guest.get("/api/x/web-access/certificate")).status, 401);
  } finally {
    await t.stop();
  }
});

test("web-access: the browser module is well formed and the internet gate needs a typed word", () => {
  assert.equal(checkFeatureModule(feature, "web-access"), null);
  assert.equal(CONFIRM_WORD, "INTERNET");
  assert.equal(typeof feature.controls.clientlist, "function");
});
