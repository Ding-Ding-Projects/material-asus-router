// The unlock ladder: four rungs graded on the server with single-use nonces. It
// clears a lock's waiting time only, never the credential, never gives tries
// back, and sets no session.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/unlock-ladder/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { peek } from "../../server/features/unlock-ladder/index.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/unlock-ladder";

// Plays the rungs the way a person would, using the answers the server holds.
async function climb(t, start = {}, { failAt = null } = {}) {
  const first = await t.owner.post(`${base}/start`, start);
  assert.equal(first.status, 200, first.text);
  let step = first.data;
  const seen = [step.name];
  for (;;) {
    const held = peek(first.data.ladderId);
    let answer;
    if (step.name === "dim-sum") answer = failAt === "dim-sum" ? "wrong" : held.answer;
    else if (step.name === "sums") answer = failAt === "sums" ? Array(10).fill(-1) : held.answer;
    else if (step.name === "moles") {
      held.issuedAt -= 60_000; // pretend the round has been played
      answer = failAt === "moles" ? [] : held.moles.map((m) => ({ index: m.index, t: m.showAt + 100 }));
    } else answer = failAt === "clock" ? "13:99" : held.answer;
    const out = await t.owner.post(`${base}/answer`, { ladderId: first.data.ladderId, nonce: step.nonce, answer });
    assert.equal(out.status, 200, out.text);
    if (out.data.finished) return { ...out.data, seen, id: first.data.ladderId, headers: out.headers };
    step = out.data;
    seen.push(step.name);
  }
}

test("unlock-ladder: every rung is won in order and the ladder clears nothing but waiting", async () => {
  const t = await startApp();
  try {
    const out = await climb(t);
    assert.deepEqual(out.seen, ["dim-sum", "sums", "moles", "clock"]);
    assert.deepEqual([out.passed, out.finished, out.cleared, out.session], [true, true, true, false]);
    assert.equal(out.headers.get("set-cookie"), null, "winning sets no session");
    assert.match(out.note, /credential was not touched/);
  } finally {
    await t.stop();
  }
});

test("unlock-ladder: each rung can be lost, and a lost ladder is over", async () => {
  const t = await startApp();
  try {
    for (const rung of ["dim-sum", "sums", "moles", "clock"]) {
      const out = await climb(t, rung === "dim-sum" || rung === "sums" || rung === "moles" || rung === "clock" ? { school: false } : {}, { failAt: rung });
      assert.deepEqual([out.passed, out.cleared, out.session], [false, false, false], rung);
      if (rung === "dim-sum") assert.equal((await t.owner.post(`${base}/answer`, { ladderId: out.id, nonce: "x", answer: "y" })).status, 410, "the ladder is over");
    }
  } finally {
    await t.stop();
  }
});

test("unlock-ladder: replayed, early, duplicate and expired answers are refused", async () => {
  const t = await startApp();
  try {
    const start = (await t.owner.post(`${base}/start`, {})).data;
    const held = peek(start.ladderId);
    const answer = { ladderId: start.ladderId, nonce: start.nonce, answer: held.answer };
    assert.equal((await t.owner.post(`${base}/answer`, answer)).status, 200);
    const replay = await t.owner.post(`${base}/answer`, answer);
    assert.deepEqual([replay.status, replay.data.code], [409, "REPLAY"]);

    // Moles: answering at once is early; a repeated mole is a duplicate.
    const a = await climbTo(t, "moles");
    const early = await t.owner.post(`${base}/answer`, { ladderId: a.id, nonce: a.step.nonce, answer: [] });
    assert.deepEqual([early.status, early.data.code], [400, "EARLY"]);
    const b = await climbTo(t, "moles");
    const rung = peek(b.id);
    rung.issuedAt -= 60_000;
    const dup = await t.owner.post(`${base}/answer`, { ladderId: b.id, nonce: b.step.nonce, answer: [{ index: 0, t: rung.moles[0].showAt + 10 }, { index: 0, t: rung.moles[0].showAt + 20 }] });
    assert.deepEqual([dup.status, dup.data.code], [400, "DUPLICATE"]);
    const c = await climbTo(t, "moles");
    const rung2 = peek(c.id);
    rung2.issuedAt -= 60_000;
    const tooSoon = await t.owner.post(`${base}/answer`, { ladderId: c.id, nonce: c.step.nonce, answer: [{ index: 0, t: rung2.moles[0].showAt - 100 }] });
    assert.equal(tooSoon.data.code, "EARLY", "a hit before the mole appears is early");

    // Expiry.
    const d = (await t.owner.post(`${base}/start`, {})).data;
    peek(d.ladderId).expiresAt = Date.now() - 1;
    const late = await t.owner.post(`${base}/answer`, { ladderId: d.ladderId, nonce: d.nonce, answer: "x" });
    assert.deepEqual([late.status, late.data.code], [410, "EXPIRED"]);
  } finally {
    await t.stop();
  }
});

async function climbTo(t, name) {
  const first = (await t.owner.post(`${base}/start`, {})).data;
  let step = first;
  while (step.name !== name) {
    const held = peek(first.ladderId);
    const answer = step.name === "dim-sum" || step.name === "sums" ? held.answer : held.answer;
    step = (await t.owner.post(`${base}/answer`, { ladderId: first.ladderId, nonce: step.nonce, answer })).data;
  }
  return { id: first.ladderId, step };
}

test("unlock-ladder: the hourly budgets are enforced and wrong answers do not refund tries", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.get(`${base}/budget`)).data.startsLeft, 6);
    // Three clears use up the clear budget.
    for (let i = 0; i < 3; i++) assert.equal((await climb(t)).cleared, true);
    const capped = await t.owner.post(`${base}/start`, {});
    assert.deepEqual([capped.status, capped.data.code], [429, "CLEAR_BUDGET"]);
    const budget = (await t.owner.get(`${base}/budget`)).data;
    assert.deepEqual([budget.startsLeft, budget.clearsLeft], [3, 0]);

    const u = await startApp();
    try {
      // Six starts, however they end, use up the start budget: losing gives nothing back.
      for (let i = 0; i < 6; i++) assert.equal((await climb(u, {}, { failAt: "dim-sum" })).passed, false);
      const out = await u.owner.post(`${base}/start`, {});
      assert.deepEqual([out.status, out.data.code], [429, "BUDGET"]);
    } finally {
      await u.stop();
    }
  } finally {
    await t.stop();
  }
});

test("unlock-ladder: School mode starts at the sums", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post(`${base}/start`, { school: false })).data.startsAtRung, 0);
    const school = (await t.owner.post(`${base}/start`, { school: true })).data;
    assert.deepEqual([school.startsAtRung, school.name], [1, "sums"]);
    await t.app.store.update((s) => void (s.settings.schoolMode = true));
    assert.equal((await t.owner.post(`${base}/start`, {})).data.name, "sums", "the saved School mode setting is read");
  } finally {
    await t.stop();
  }
});

test("unlock-ladder: winning clears the wait on a lock but never the credential", async () => {
  const t = await startApp();
  try {
    const lock = await t.owner.post("/api/x/element-locks/lock", { key: "overview: Ladder", mix: "pin", pin: "2468" });
    assert.equal(lock.status, 200, lock.text);
    await t.owner.post("/api/x/element-locks/relock", { key: "overview: Ladder" });
    for (let i = 0; i < 3; i++) assert.equal((await t.owner.post("/api/x/element-locks/unlock", { key: "overview: Ladder", pin: "0000" })).status, i < 3 ? 401 : 423);
    const waiting = await t.owner.post("/api/x/element-locks/unlock", { key: "overview: Ladder", pin: "2468" });
    assert.deepEqual([waiting.status, waiting.data.code], [423, "WAITING"], "even the right PIN waits");
    const won = await climb(t, { lockKey: "overview: Ladder" });
    assert.equal(won.cleared, true);
    // The wait is gone and the PIN is unchanged: the right one works, a wrong one still fails
    // (and the failed tries were not given back, so it starts a longer wait again).
    assert.equal((await t.owner.post("/api/x/element-locks/unlock", { key: "overview: Ladder", pin: "2468" })).status, 200);
    await t.owner.post("/api/x/element-locks/relock", { key: "overview: Ladder" });
    for (let i = 0; i < 3; i++) await t.owner.post("/api/x/element-locks/unlock", { key: "overview: Ladder", pin: "0000" });
    assert.equal((await t.owner.post("/api/x/element-locks/unlock", { key: "overview: Ladder", pin: "2468" })).status, 423);
    assert.equal((await climb(t, { lockKey: "overview: Ladder" })).cleared, true, "a second clear, still inside the hourly cap");
    const wrong = await t.owner.post("/api/x/element-locks/unlock", { key: "overview: Ladder", pin: "1111" });
    assert.deepEqual([wrong.status, wrong.data.code], [401, "BAD_CREDENTIAL"]);
    const state = (await t.owner.get("/api/x/element-locks/state")).data;
    assert.ok(state.locks.find((l) => l.key === "overview: Ladder").waitSeconds > 0, "tries were not refunded: the wrong PIN started a longer wait");
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "unlock-ladder"), null);
});
