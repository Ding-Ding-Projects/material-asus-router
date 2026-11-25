// The spoken narrator. It reads the app's own messages aloud with the browser's
// speech engine, in English, Cantonese or both. It is off by default, speaks one
// thing at a time, never repeats itself in a rush, and never holds back an error.
//
// A web page cannot detect a screen reader, so "yield to a screen reader" is an
// explicit setting the person controls; the narrator stays silent while it is on.

const CJK = /[㐀-鿿豈-﫿]/;
export const RATE = Object.freeze({ min: 0.5, max: 2, step: 0.1, default: 1 });
export const PITCH = Object.freeze({ min: 0, max: 2, step: 0.1, default: 1 });
export const clampRate = (v) => Math.min(RATE.max, Math.max(RATE.min, Number.isFinite(Number(v)) ? Number(v) : RATE.default));
export const clampPitch = (v) => Math.min(PITCH.max, Math.max(PITCH.min, Number.isFinite(Number(v)) ? Number(v) : PITCH.default));

// Splits a bilingual message into one piece per language. A piece with any
// Chinese character is Cantonese, anything else is English.
export function splitTracks(message) {
  const pieces = String(message ?? "").split(/\n| · /).map((p) => p.trim()).filter(Boolean);
  const tracks = [];
  for (const piece of pieces) {
    const lang = CJK.test(piece) ? "yue" : "en";
    if (!tracks.some((t) => t.lang === lang && t.text === piece)) tracks.push({ lang, text: piece });
  }
  return tracks;
}

// Which tracks the language mode wants spoken, English before Cantonese.
export function tracksFor(message, mode) {
  const all = splitTracks(message);
  const pick = (lang) => all.filter((t) => t.lang === lang);
  if (mode === "en") return pick("en");
  if (mode === "yue") return pick("yue");
  return [...pick("en"), ...pick("yue")];
}

const isYue = (v) => /^(yue|zh[-_]HK)/i.test(v.lang ?? "") || /cantonese|hong ?kong|粵|廣東|香港/i.test(v.name ?? "");
const isEn = (v) => /^en([-_]|$)/i.test(v.lang ?? "");
export const voicesFor = (voices, lang) => voices.filter(lang === "yue" ? isYue : isEn);

export const voiceKey = (v) => ({ uri: v.voiceURI ?? "", name: v.name ?? "", lang: v.lang ?? "" });

// The voice a track will use, and the reason in one word. A saved choice is
// matched by its URI, then by name and language. "auto" prefers the system
// default for English and the first Hong Kong Cantonese voice for Cantonese.
// A Cantonese track never borrows a Mandarin voice: it says it has none.
export function chooseVoice(voices, pref, lang) {
  const pool = voicesFor(voices, lang);
  if (pref) {
    const exact = pool.find((v) => pref.uri && v.voiceURI === pref.uri) ?? pool.find((v) => v.name === pref.name && v.lang === pref.lang);
    if (exact) return { voice: exact, how: "chosen" };
    const missing = true;
    const auto = pickAuto(pool, lang);
    return auto ? { voice: auto, how: "auto", missing } : { voice: null, how: "none", missing };
  }
  const auto = pickAuto(pool, lang);
  return auto ? { voice: auto, how: "auto" } : { voice: null, how: "none" };
}
function pickAuto(pool, lang) {
  if (!pool.length) return null;
  if (lang === "yue") return pool.find((v) => /^(yue|zh[-_]HK)/i.test(v.lang)) ?? pool[0];
  return pool.find((v) => v.default) ?? pool.find((v) => /^en[-_](GB|US)/i.test(v.lang)) ?? pool[0];
}

export function createNarrator({ synth, Utterance, getSettings, getLang, clock = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), onState = () => {} } = {}) {
  const available = Boolean(synth && Utterance);
  const queue = [];
  const recent = new Map();
  let speaking = null;
  let watchdog = null;
  let lastEnqueue = -Infinity;
  let voices = [];
  const state = { available, speaking: false, spoken: 0, dropped: 0, lastError: "" };

  const readVoices = () => {
    try {
      voices = synth?.getVoices?.() ?? [];
    } catch {
      voices = [];
    }
    onState({ voices });
    return voices;
  };

  // Voices can arrive late or never: ask now, again when the engine says they
  // changed, and once more after a short wait.
  function watchVoices() {
    if (!available) return () => {};
    readVoices();
    const handler = () => readVoices();
    synth.addEventListener?.("voiceschanged", handler);
    const timer = setTimer(handler, 1500);
    return () => {
      synth.removeEventListener?.("voiceschanged", handler);
      clearTimer(timer);
    };
  }

  function effective(lang) {
    const settings = getSettings();
    return chooseVoice(voices, settings.narration.voices[lang], lang);
  }

  function pump() {
    if (speaking || !queue.length) return;
    const item = queue.shift();
    const settings = getSettings();
    const { voice } = effective(item.lang);
    if (item.lang === "yue" && !voice) {
      state.dropped++;
      state.lastError = "no-cantonese-voice";
      onState({ error: "no-cantonese-voice" });
      return pump();
    }
    let utterance;
    try {
      utterance = new Utterance(item.text);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || (item.lang === "yue" ? "zh-HK" : "en-GB");
      utterance.rate = clampRate(settings.narration.rate);
      utterance.pitch = clampPitch(settings.narration.pitch);
    } catch {
      state.lastError = "utterance";
      return pump();
    }
    speaking = item;
    state.speaking = true;
    const done = () => {
      if (speaking !== item) return;
      clearTimer(watchdog);
      speaking = null;
      state.speaking = false;
      state.spoken++;
      onState({ spoken: state.spoken });
      pump();
    };
    utterance.onend = done;
    utterance.onerror = done;
    // A stuck engine must never freeze the queue.
    watchdog = setTimer(done, Math.min(20000, 3000 + item.text.length * 120));
    try {
      synth.speak(utterance);
    } catch {
      done();
    }
  }

  // speak(message, { priority: "error" | "normal" }). Errors are never dropped
  // for being repeated or too frequent; ordinary messages are.
  function speak(message, { priority = "normal" } = {}) {
    const settings = getSettings();
    if (!available || !settings.narration.on || settings.narration.screenReader) return { spoken: false, why: !available ? "no-speech" : settings.narration.screenReader ? "screen-reader" : "off" };
    const tracks = tracksFor(message, getLang());
    if (!tracks.length) return { spoken: false, why: "empty" };
    const at = clock();
    const key = tracks.map((t) => t.text).join("|");
    const isError = priority === "error";
    if (!isError) {
      if (recent.has(key) && at - recent.get(key) < 2500) return { spoken: false, why: "repeat" };
      if (at - lastEnqueue < 500) {
        state.dropped++;
        return { spoken: false, why: "rate-limited" };
      }
    } else if (recent.has(key) && at - recent.get(key) < 300) return { spoken: false, why: "repeat" };
    recent.set(key, at);
    if (recent.size > 40) recent.delete(recent.keys().next().value);
    if (!isError) lastEnqueue = at;
    const items = tracks.map((t) => ({ ...t, error: isError }));
    if (isError) {
      // Errors go ahead of waiting messages but never cut off what is being said.
      const firstNormal = queue.findIndex((q) => !q.error);
      queue.splice(firstNormal === -1 ? queue.length : firstNormal, 0, ...items);
    } else {
      queue.push(...items);
      while (queue.filter((q) => !q.error).length > 6) queue.splice(queue.findIndex((q) => !q.error), 1);
    }
    pump();
    return { spoken: true, tracks: tracks.map((t) => t.lang) };
  }

  function stop() {
    queue.length = 0;
    clearTimer(watchdog);
    speaking = null;
    state.speaking = false;
    try {
      synth?.cancel?.();
    } catch {}
  }

  return { speak, stop, watchVoices, readVoices, effective, state, get voices() { return voices; }, get queueLength() { return queue.length; } };
}
