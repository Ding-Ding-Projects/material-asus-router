// Pure helpers for the DSL screen: a plain-words reading of the line, the
// "retrain" timeline that keeps updating until the line is back and the
// settings read back, and the speed text. No DOM, so Node tests can run it.

export const STEPS = ["sent", "down", "training", "up", "readback"];

export const kbpsText = (kbps) => (kbps === null || kbps === undefined ? "-" : kbps >= 1000 ? `${(kbps / 1000).toFixed(kbps >= 10000 ? 1 : 2)} Mbit/s` : `${kbps} kbit/s`);
export const dbText = (db) => (db === null || db === undefined ? "-" : `${db.toFixed(1)} dB`);

export const VERDICT_WORDS = {
  strong: { icon: "signal_cellular_alt", tone: "good", en: "A strong, steady line.", yue: "線路強勁穩定。" },
  "snr-ok": { icon: "signal_cellular_alt_2_bar", tone: "warn", en: "The line works, but with little spare margin. Drop-outs are possible in bad weather.", yue: "線路用得，但餘量唔多。天氣差時可能會斷線。" },
  "snr-low": { icon: "signal_cellular_alt_1_bar", tone: "bad", en: "The noise margin is very low. Expect drop-outs. Ask your provider to check the line.", yue: "雜訊餘量好低，容易斷線。請供應商檢查線路。" },
  training: { icon: "sync", tone: "wait", en: "The modem is training the line. This takes a minute or two.", yue: "數據機訓練緊線路，需要一至兩分鐘。" },
  down: { icon: "link_off", tone: "bad", en: "The line is down. Check the phone cable and the filter.", yue: "線路斷咗。請檢查電話線同濾波器。" },
  unknown: { icon: "help", tone: "wait", en: "The modem did not report a noise margin yet.", yue: "數據機未報告雜訊餘量。" },
};

// A gauge position from 0 to 1 for an SNR margin (0 to 20 dB is the useful range).
export const gauge = (db, max = 20) => (typeof db === "number" ? Math.max(0, Math.min(1, db / max)) : 0);

// Follows a retrain. observe(state, now) takes what the line says ("up", "down",
// "training" or "unknown") and returns the five steps and whether it has finished.
export function createTimeline(startedAt, { graceMs = 6000 } = {}) {
  let seenDown = false;
  let seenTraining = false;
  let upAt = null;
  let readBack = false;
  return {
    observe(state, now = Date.now()) {
      if (state === "down") seenDown = true;
      if (state === "training") { seenDown = true; seenTraining = true; }
      // A line that never dropped within the grace time simply kept its sync.
      const stayedUp = state === "up" && !seenDown && now - startedAt >= graceMs;
      if (state === "up" && (seenDown || stayedUp) && upAt === null) upAt = now;
      return this.steps();
    },
    confirmReadBack() { readBack = upAt !== null; return this.steps(); },
    steps() {
      const reached = [true, seenDown, seenTraining || upAt !== null, upAt !== null, readBack];
      const first = reached.findIndex((r) => !r);
      return STEPS.map((id, i) => ({ id, status: reached[i] ? "done" : i === first ? "active" : "wait" }));
    },
    get upAt() { return upAt; },
    get finished() { return readBack; },
  };
}

export const STEP_WORDS = {
  sent: { en: "Restart sent to the modem", yue: "已向數據機發出重啟" },
  down: { en: "Line goes down", yue: "線路斷開" },
  training: { en: "Modem trains the line", yue: "數據機訓練線路" },
  up: { en: "Line is back in sync", yue: "線路重新同步" },
  readback: { en: "Settings read back from the router", yue: "由路由器讀返設定" },
};
