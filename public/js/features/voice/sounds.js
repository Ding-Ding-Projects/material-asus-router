// Action sounds. Short cues made on the spot with the browser's audio engine
// (oscillators and gain envelopes), so there are no sound files to download,
// license or ship. One playback service plays everything: it never blocks an
// action, never throws, and obeys the Settings switch, mute, volume, reduced
// sound and quiet hours. A sound only ever accompanies the visible result; it
// never replaces it, and a sound that cannot play changes nothing.

// Every cue, as a list of notes: frequency in Hz, start offset and length in
// seconds, wave shape and peak gain. Provenance: all generated at runtime from
// these numbers; nothing is recorded or sampled.
export const CUES = {
  success: { important: false, notes: [{ f: 660, at: 0, d: 0.09, type: "sine", g: 0.5 }, { f: 880, at: 0.08, d: 0.16, type: "sine", g: 0.5 }] },
  applied: { important: false, notes: [{ f: 523.25, at: 0, d: 0.08, type: "triangle", g: 0.5 }, { f: 659.25, at: 0.07, d: 0.08, type: "triangle", g: 0.5 }, { f: 783.99, at: 0.14, d: 0.18, type: "triangle", g: 0.5 }] },
  error: { important: true, notes: [{ f: 233, at: 0, d: 0.14, type: "triangle", g: 0.55 }, { f: 175, at: 0.13, d: 0.24, type: "triangle", g: 0.55 }] },
  warn: { important: true, notes: [{ f: 392, at: 0, d: 0.1, type: "square", g: 0.18 }, { f: 392, at: 0.14, d: 0.1, type: "square", g: 0.18 }] },
  notice: { important: false, notes: [{ f: 740, at: 0, d: 0.08, type: "sine", g: 0.4 }] },
  pop: { important: false, notes: [{ f: 520, at: 0, d: 0.05, type: "sine", g: 0.45 }, { f: 780, at: 0.04, d: 0.09, type: "sine", g: 0.45 }] },
  tada: { important: false, forced: true, notes: [{ f: 523.25, at: 0, d: 0.14, type: "triangle", g: 0.45 }, { f: 659.25, at: 0.12, d: 0.14, type: "triangle", g: 0.45 }, { f: 783.99, at: 0.24, d: 0.14, type: "triangle", g: 0.45 }, { f: 1046.5, at: 0.36, d: 0.55, type: "triangle", g: 0.5 }, { f: 1318.5, at: 0.36, d: 0.55, type: "sine", g: 0.25 }] },
  invalid: { important: true, forced: true, notes: [{ f: 196, at: 0, d: 0.09, type: "square", g: 0.16 }, { f: 147, at: 0.1, d: 0.16, type: "square", g: 0.16 }] },
};

// What triggers which cue, in plain words. The settings screen shows this table.
export const CUE_MAP = [
  { cue: "success", when: { en: "A message says something worked (for example copied or saved)", yue: "訊息話做成功（例如已複製或已儲存）" } },
  { cue: "applied", when: { en: "Changes were applied to the router", yue: "改動已套用到路由器" } },
  { cue: "error", when: { en: "A message says something went wrong", yue: "訊息話出咗問題" } },
  { cue: "warn", when: { en: "A dialog asks you to confirm a risky action", yue: "對話框要你確認有風險嘅動作" } },
  { cue: "notice", when: { en: "A schedule rule switched your settings", yue: "排程規則轉咗你嘅設定" } },
  { cue: "pop", when: { en: "A dim sum surprise appeared", yue: "點心驚喜出現" } },
  { cue: "tada", when: { en: "Personal wording was applied", yue: "個人用詞已套用" } },
  { cue: "invalid", when: { en: "A dropped or chosen file was refused", yue: "拖放或揀嘅檔案被拒絕" } },
];

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

// Quiet hours may run past midnight (22:00 to 07:00).
export function inQuietHours(date, from, to) {
  const now = date.getHours() * 60 + date.getMinutes();
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a === b) return false;
  return a < b ? now >= a && now < b : now >= a || now < b;
}

// Decides whether a cue may play and why not. Pure, so it is easy to test.
export function decide({ settings, lowStimulation = false, cue, date, sinceLast = Infinity }) {
  const def = CUES[cue];
  if (!def) return { play: false, reason: "unknown-cue" };
  const s = settings.sound;
  if (!s.on) return { play: false, reason: "switched-off" };
  if (s.muted) return { play: false, reason: "muted" };
  if (s.volume <= 0) return { play: false, reason: "volume-zero" };
  if (s.quiet.on && inQuietHours(date, s.quiet.from, s.quiet.to)) return { play: false, reason: "quiet-hours" };
  if ((s.reduced || lowStimulation) && !def.important) return { play: false, reason: "reduced-sound" };
  if (sinceLast < 90) return { play: false, reason: "too-soon" };
  return { play: true, reason: "ok", gain: (s.volume / 100) * 0.3 };
}

export function createSounds({ getSettings, isLowStimulation = () => false, now = () => new Date(), clock = () => Date.now(), makeContext } = {}) {
  let ctx = null;
  let lastAt = -Infinity;
  const log = [];
  const state = { available: true, last: null };

  function context() {
    if (ctx) return ctx;
    try {
      const make = makeContext ?? (() => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)());
      ctx = make();
    } catch {
      state.available = false;
      ctx = null;
    }
    return ctx;
  }

  // play never throws and never waits: the caller's action is already done.
  function play(cue) {
    try {
      const verdict = decide({ settings: getSettings(), lowStimulation: isLowStimulation(), cue, date: now(), sinceLast: clock() - lastAt });
      state.last = { cue, ...verdict };
      log.push(state.last);
      if (log.length > 50) log.shift();
      if (!verdict.play) return verdict;
      const audio = context();
      if (!audio) return { play: false, reason: "audio-unavailable" };
      lastAt = clock();
      audio.resume?.()?.catch?.(() => {});
      const base = audio.currentTime ?? 0;
      for (const note of CUES[cue].notes) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = note.type;
        osc.frequency.value = note.f;
        const peak = Math.max(0.0001, verdict.gain * note.g);
        gain.gain.setValueAtTime(0.0001, base + note.at);
        gain.gain.exponentialRampToValueAtTime(peak, base + note.at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, base + note.at + note.d);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(base + note.at);
        osc.stop(base + note.at + note.d + 0.02);
      }
      return verdict;
    } catch {
      state.available = false;
      return { play: false, reason: "audio-unavailable" };
    }
  }

  return { play, state, log };
}
