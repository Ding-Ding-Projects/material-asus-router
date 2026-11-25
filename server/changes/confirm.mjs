// Confirmations the server enforces itself, so a script that skips the screen
// cannot skip the safety.
//
// Four-key confirmation (any change or action with an impact of 1 or more):
//   a. acknowledge the people who will be affected, by id
//   b. type the setting's short name exactly
//   c. hold the button for at least 1500 ms
//   d. press the Ctrl+Shift+Enter chord
// The server issues a nonce for one target (one preview, one action) and one
// person. The proof is checked against that nonce, once, and then the nonce is spent.
//
// Launch sequence (reboot only): cover open, arm, typed launch code, two keys
// held together, a countdown that can be aborted, then launch.
import { randomBytes, randomUUID } from "node:crypto";

export const HOLD_MIN_MS = 1500;
export const CHORD = "Ctrl+Shift+Enter";
const NONCE_MS = 5 * 60 * 1000;
const LAUNCH_MS = 10 * 60 * 1000;
const KEYS_TOGETHER_MS = 800;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const refuse = (en, yue, code, status = 403, detail = undefined) => Object.assign(new Error(en), { status, code, yue, detail });

export class Confirmations {
  constructor({ now = () => Date.now(), holdMs = HOLD_MIN_MS } = {}) {
    this.now = now;
    this.holdMs = holdMs;
    this.nonces = new Map();
  }

  #sweep() {
    const t = this.now();
    for (const [id, n] of this.nonces) if (n.expiresAt < t) this.nonces.delete(id);
  }

  // target: "preview:<id>" or "action:<name>". people: [{ id, name }].
  begin({ userId, target, impact, shortName, people }) {
    this.#sweep();
    const nonce = randomBytes(18).toString("base64url");
    const rec = { nonce, userId, target, impact, shortName, people: people.map((p) => p.id), issuedAt: this.now(), expiresAt: this.now() + NONCE_MS };
    this.nonces.set(nonce, rec);
    return {
      nonce,
      target,
      impact,
      expiresAt: new Date(rec.expiresAt).toISOString(),
      steps: {
        acknowledge: { people },
        typeName: { shortName },
        hold: { minMs: this.holdMs },
        chord: { keys: CHORD },
      },
    };
  }

  // Checks all four keys and spends the nonce. Throws a specific refusal for the first missing step.
  verify({ userId, target, proof }) {
    this.#sweep();
    const p = proof ?? {};
    const rec = this.nonces.get(String(p.nonce ?? ""));
    if (!rec) throw refuse("Confirm again: the confirmation was missing or has expired.", "要重新確認：冇確認或者已經過期。", "CONFIRM_NONCE");
    if (rec.userId !== userId) throw refuse("That confirmation belongs to someone else.", "呢個確認係另一位用戶嘅。", "CONFIRM_NONCE");
    if (rec.target !== target) throw refuse("That confirmation was for a different change.", "呢個確認係針對另一個改動。", "CONFIRM_NONCE");
    const ack = Array.isArray(p.ackPeople) ? p.ackPeople.map(String) : [];
    const missing = rec.people.filter((id) => !ack.includes(id));
    if (missing.length) throw refuse("Acknowledge every person who will be affected.", "要逐個確認會受影響嘅人。", "CONFIRM_ACK", 403, { missing });
    if (String(p.typed ?? "").trim() !== rec.shortName) throw refuse(`Type the setting's name exactly: ${rec.shortName}`, `要一字不差打出設定名稱：${rec.shortName}`, "CONFIRM_TYPED");
    const held = Number(p.holdMs);
    const elapsed = this.now() - rec.issuedAt;
    if (!Number.isFinite(held) || held < this.holdMs) throw refuse(`Hold the button for at least ${this.holdMs} ms.`, `要撳住個掣至少 ${this.holdMs} 毫秒。`, "CONFIRM_HOLD");
    if (held > elapsed + 100) throw refuse("That hold is longer than the time that has passed.", "撳住嘅時間比實際經過嘅時間長。", "CONFIRM_HOLD");
    if (p.chord !== true) throw refuse(`Press ${CHORD} to finish.`, `要撳 ${CHORD} 完成。`, "CONFIRM_CHORD");
    this.nonces.delete(rec.nonce);
    return { impact: rec.impact, shortName: rec.shortName };
  }
}

// ---- launch sequence ----------------------------------------------------------

const ORDER = ["covered", "cover-open", "armed", "code-ok", "keys-held", "countdown", "launched"];
const NEXT = {
  covered: "open-cover",
  "cover-open": "arm",
  armed: "code",
  "code-ok": "keys",
  "keys-held": "countdown",
  countdown: "launch",
};

export class LaunchSequences {
  constructor({ now = () => Date.now(), countdownMs = 10000, keysTogetherMs = KEYS_TOGETHER_MS } = {}) {
    this.now = now;
    this.countdownMs = countdownMs;
    this.keysTogetherMs = keysTogetherMs;
    this.runs = new Map();
  }

  #sweep() {
    const t = this.now();
    for (const [id, r] of this.runs) if (r.expiresAt < t && !["launched"].includes(r.state)) this.runs.delete(id);
  }

  begin({ userId, target = "reboot" }) {
    this.#sweep();
    const run = { id: randomUUID(), userId, target, state: "covered", startedAt: this.now(), expiresAt: this.now() + LAUNCH_MS, code: null, attempts: 0, keys: {}, bothDownAt: null, countdownStartedAt: null, countdownEndsAt: null, runId: null };
    this.runs.set(run.id, run);
    return this.view(run);
  }

  #get(id, userId) {
    this.#sweep();
    const run = this.runs.get(String(id));
    if (!run || run.userId !== userId) throw refuse("That launch sequence does not exist or has expired.", "呢個發射程序唔存在或者已經過期。", "LAUNCH_GONE", 404);
    if (run.state === "aborted") throw refuse("That launch was aborted. Start again.", "發射已經中止，要重新開始。", "LAUNCH_ABORTED", 409);
    if (run.state === "launched") throw refuse("That launch already happened.", "已經發射咗。", "LAUNCH_DONE", 409);
    return run;
  }

  view(run) {
    const left = run.countdownEndsAt ? Math.max(run.countdownEndsAt - this.now(), 0) : null;
    return { id: run.id, target: run.target, state: run.state, next: NEXT[run.state] ?? null, countdownMs: this.countdownMs, countdownLeftMs: left, keysDown: { 1: Boolean(run.keys[1]), 2: Boolean(run.keys[2]) }, attemptsLeft: Math.max(3 - run.attempts, 0), expiresAt: new Date(run.expiresAt).toISOString(), runId: run.runId };
  }

  #need(run, state, step) {
    if (run.state !== state) throw refuse(`Not yet: the next step is ${NEXT[run.state] ?? run.state}.`, `未得：下一步係 ${NEXT[run.state] ?? run.state}。`, "LAUNCH_ORDER", 409, { state: run.state, next: NEXT[run.state] ?? null, tried: step });
  }

  openCover(id, userId) {
    const run = this.#get(id, userId);
    this.#need(run, "covered", "open-cover");
    run.state = "cover-open";
    return this.view(run);
  }

  // Arming issues the launch code. The person must read it and type it back.
  arm(id, userId) {
    const run = this.#get(id, userId);
    this.#need(run, "cover-open", "arm");
    run.state = "armed";
    run.code = Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    return { ...this.view(run), code: run.code };
  }

  code(id, userId, typed) {
    const run = this.#get(id, userId);
    this.#need(run, "armed", "code");
    if (String(typed ?? "").trim().toUpperCase() !== run.code) {
      run.attempts += 1;
      if (run.attempts >= 3) {
        run.state = "aborted";
        throw refuse("Wrong launch code three times. The launch is aborted.", "發射碼錯咗三次，發射中止。", "LAUNCH_CODE", 403);
      }
      throw refuse("That is not the launch code.", "發射碼唔啱。", "LAUNCH_CODE", 403, { attemptsLeft: 3 - run.attempts });
    }
    run.state = "code-ok";
    return this.view(run);
  }

  // Two keys, pressed and held together. `state` is "down" or "up" for key 1 or 2.
  key(id, userId, which, state) {
    const run = this.#get(id, userId);
    if (!["code-ok", "keys-held"].includes(run.state)) this.#need(run, "code-ok", "keys");
    if (which !== 1 && which !== 2) throw refuse("There are two keys, 1 and 2.", "有兩把匙，1 同 2。", "LAUNCH_KEY", 400);
    if (state === "down") run.keys[which] = this.now();
    else delete run.keys[which];
    run.bothDownAt = run.keys[1] && run.keys[2] ? Math.max(run.keys[1], run.keys[2]) : null;
    return this.view(run);
  }

  // The keys count as held together only when both have been down for a moment, at this very time.
  keysReady(id, userId) {
    const run = this.#get(id, userId);
    this.#need(run, "code-ok", "keys");
    if (!run.keys[1] || !run.keys[2]) throw refuse("Both keys must be held down together.", "兩把匙要同時撳住。", "LAUNCH_KEYS", 409);
    if (this.now() - run.bothDownAt < this.keysTogetherMs) throw refuse("Keep both keys held a little longer.", "兩把匙要再撳耐啲。", "LAUNCH_KEYS", 409);
    run.state = "keys-held";
    return this.view(run);
  }

  countdown(id, userId) {
    const run = this.#get(id, userId);
    this.#need(run, "keys-held", "countdown");
    run.state = "countdown";
    run.countdownStartedAt = this.now();
    run.countdownEndsAt = this.now() + this.countdownMs;
    return this.view(run);
  }

  abort(id, userId) {
    this.#sweep();
    const run = this.runs.get(String(id));
    if (!run || run.userId !== userId) throw refuse("That launch sequence does not exist or has expired.", "呢個發射程序唔存在或者已經過期。", "LAUNCH_GONE", 404);
    if (run.state === "launched") throw refuse("Too late: the launch already happened.", "太遲喇，已經發射咗。", "LAUNCH_DONE", 409);
    run.state = "aborted";
    return this.view(run);
  }

  // Checks everything and marks the launch as done. The caller then sends the reboot.
  launch(id, userId) {
    const run = this.#get(id, userId);
    this.#need(run, "countdown", "launch");
    if (this.now() < run.countdownEndsAt) throw refuse("The countdown is not finished.", "倒數未完。", "LAUNCH_TOO_EARLY", 409, { leftMs: run.countdownEndsAt - this.now() });
    run.state = "launched";
    return run;
  }

  attachRun(run, runId) {
    run.runId = runId;
    return this.view(run);
  }
}

export { ORDER as LAUNCH_ORDER };
