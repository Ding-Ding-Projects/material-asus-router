// The unlock ladder: four small rungs (a dim sum choice, ten easy sums, a
// whack-a-mole round and reading a clock) that clear the WAITING time after
// too many wrong lock attempts. It never clears or reveals a credential, does
// not give attempts back, and is capped per rolling hour. Every rung is graded
// here with a single-use nonce, so an early, repeated or replayed answer is
// refused. Winning sets no session and signs nobody in.
import { randomBytes, randomInt } from "node:crypto";

const ID = "unlock-ladder";
const HOUR = 3600 * 1000;
const START_BUDGET = 6; // ladders that may be started per rolling hour
const CLEAR_BUDGET = 3; // waits that may be cleared per rolling hour
const RUNG_MS = 2 * 60 * 1000;
export const RUNGS = ["dim-sum", "sums", "moles", "clock"];

const DISHES = [
  { id: "har-gow", emoji: "🦐", en: "Har gow (shrimp dumpling)", yue: "蝦餃" },
  { id: "siu-mai", emoji: "🥟", en: "Siu mai", yue: "燒賣" },
  { id: "egg-tart", emoji: "🥧", en: "Egg tart", yue: "蛋撻" },
  { id: "cheung-fun", emoji: "🍜", en: "Rice noodle roll", yue: "腸粉" },
  { id: "bao", emoji: "🥯", en: "Char siu bao", yue: "叉燒包" },
  { id: "tea", emoji: "🍵", en: "Pot of tea", yue: "一壺茶" },
];

const shuffle = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const pad = (n) => String(n).padStart(2, "0");

const ladders = new Map();
const logs = new WeakMap();
const laddersOf = () => ladders;
const historyOf = (app) => {
  if (!logs.has(app)) logs.set(app, { starts: [], clears: [] });
  return logs.get(app);
};
// For tests only: the answer the server holds for a ladder's current rung.
export const peek = (ladderId) => ladders.get(ladderId)?.current ?? null;
const fresh = (list) => list.filter((at) => at > Date.now() - HOUR);

function makeRung(name) {
  const nonce = randomBytes(12).toString("base64url");
  const base = { name, nonce, issuedAt: Date.now(), expiresAt: Date.now() + RUNG_MS, used: false };
  if (name === "dim-sum") {
    const options = shuffle(DISHES).slice(0, 4);
    const answer = options[randomInt(4)];
    return { ...base, answer: answer.id, view: { question: { en: `Which one is ${answer.en}?`, yue: `邊個係${answer.yue}？` }, options: options.map((o) => ({ id: o.id, emoji: o.emoji, en: o.en, yue: o.yue })) } };
  }
  if (name === "sums") {
    const sums = Array.from({ length: 10 }, () => {
      const a = 1 + randomInt(12);
      const b = 1 + randomInt(9);
      return randomInt(2) ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} - ${b}`, a };
    });
    return { ...base, answer: sums.map((s) => s.a), view: { questions: sums.map((s) => s.q) } };
  }
  if (name === "moles") {
    let at = 600;
    const moles = Array.from({ length: 5 }, (_, i) => {
      at += 700 + randomInt(500);
      return { index: i, hole: randomInt(9), showAt: at, window: 900 };
    });
    return { ...base, moles, view: { holes: 9, moles: moles.map(({ index, hole, showAt, window }) => ({ index, hole, showAt, window })), need: 4 } };
  }
  const hour = 1 + randomInt(12);
  const minute = randomInt(12) * 5;
  const times = new Set([`${hour}:${pad(minute)}`]);
  while (times.size < 4) times.add(`${1 + randomInt(12)}:${pad(randomInt(12) * 5)}`);
  return { ...base, answer: `${hour}:${pad(minute)}`, view: { hour, minute, options: shuffle([...times]) } };
}

function grade(rung, answer, now) {
  if (rung.name === "dim-sum") return answer === rung.answer;
  if (rung.name === "sums") return Array.isArray(answer) && answer.length === 10 && answer.every((v, i) => Number(v) === rung.answer[i]);
  if (rung.name === "clock") return answer === rung.answer;
  // moles: answer is a list of { index, t } hit times in ms from the rung's start.
  const hits = Array.isArray(answer) ? answer : [];
  const seen = new Set();
  const elapsed = now - rung.issuedAt;
  if (elapsed < rung.moles[rung.moles.length - 1].showAt) return "early";
  let good = 0;
  for (const hit of hits) {
    const mole = rung.moles[Number(hit?.index)];
    if (!mole || seen.has(mole.index)) return "duplicate";
    seen.add(mole.index);
    const t = Number(hit.t);
    if (!Number.isFinite(t) || t < mole.showAt) return "early";
    if (t <= mole.showAt + mole.window) good++;
  }
  return good >= 4;
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/budget", ({ app }) => {
      const log = historyOf(app);
      log.starts = fresh(log.starts);
      log.clears = fresh(log.clears);
      return { startsLeft: Math.max(0, START_BUDGET - log.starts.length), clearsLeft: Math.max(0, CLEAR_BUDGET - log.clears.length), startBudget: START_BUDGET, clearBudget: CLEAR_BUDGET, windowMinutes: 60 };
    });

    api.post("/start", ({ app, who, body, bad }) => {
      const log = historyOf(app);
      log.starts = fresh(log.starts);
      log.clears = fresh(log.clears);
      if (log.starts.length >= START_BUDGET) throw bad("The ladder has been tried too often this hour. Wait for the hour to pass; this does not refund attempts.", 429, { code: "BUDGET" });
      if (log.clears.length >= CLEAR_BUDGET) throw bad("The ladder has already cleared the wait three times this hour.", 429, { code: "CLEAR_BUDGET" });
      const school = body.school === true || app.store.read().settings?.schoolMode === true;
      const lockKey = String(body.lockKey ?? "").slice(0, 160);
      log.starts.push(Date.now());
      const ladder = { id: randomBytes(12).toString("base64url"), userId: who.userId, lockKey, school, rung: school ? 1 : 0, current: null, over: false };
      ladder.current = makeRung(RUNGS[ladder.rung]);
      laddersOf(app).set(ladder.id, ladder);
      return { ladderId: ladder.id, rungs: RUNGS, startsAtRung: ladder.rung, school, rung: ladder.rung, name: ladder.current.name, nonce: ladder.current.nonce, expiresInSeconds: RUNG_MS / 1000, challenge: ladder.current.view };
    });

    api.post("/answer", ({ app, who, body, bad }) => {
      const ladder = laddersOf(app).get(String(body.ladderId ?? ""));
      if (!ladder || ladder.userId !== who.userId || ladder.over) throw bad("That ladder is finished. Start again.", 410);
      const rung = ladder.current;
      if (rung.nonce !== body.nonce || rung.used) throw bad("That answer was already used or is not for this step.", 409, { code: "REPLAY" });
      rung.used = true; // single use, right or wrong
      if (Date.now() > rung.expiresAt) {
        ladder.over = true;
        throw bad("That step timed out. Start again; this does not refund attempts.", 410, { code: "EXPIRED" });
      }
      const result = grade(rung, body.answer, Date.now());
      if (result === "early" || result === "duplicate") {
        ladder.over = true;
        throw bad(result === "early" ? "That answer came too early to be real." : "That answer repeated a mole.", 400, { code: result.toUpperCase() });
      }
      if (!result) {
        ladder.over = true;
        return { passed: false, finished: true, cleared: false, session: false };
      }
      if (ladder.rung === RUNGS.length - 1) {
        ladder.over = true;
        historyOf(app).clears.push(Date.now());
        if (ladder.lockKey) app.lockWaits?.delete(ladder.lockKey);
        return { passed: true, finished: true, cleared: true, lockKey: ladder.lockKey, session: false, note: "The waiting time was cleared. The credential was not touched and nobody was signed in." };
      }
      ladder.rung += 1;
      ladder.current = makeRung(RUNGS[ladder.rung]);
      return { passed: true, finished: false, rung: ladder.rung, name: ladder.current.name, nonce: ladder.current.nonce, expiresInSeconds: RUNG_MS / 1000, challenge: ladder.current.view };
    });
  },
};
