/* Action sound effects: short synthesized cues through one non-blocking Web Audio service. */
import { define, get, root } from './core.js';

let ctx = null;
const CUES = {
  click: [[620, 0.05, 'sine']],
  open: [[440, 0.07, 'sine'], [660, 0.09, 'sine']],
  close: [[660, 0.06, 'sine'], [440, 0.08, 'sine']],
  success: [[523, 0.09, 'triangle'], [659, 0.09, 'triangle'], [784, 0.16, 'triangle']],
  tada: [[523, 0.1, 'triangle'], [659, 0.1, 'triangle'], [784, 0.1, 'triangle'], [1047, 0.28, 'triangle']],
  notify: [[880, 0.08, 'sine'], [1175, 0.12, 'sine']],
  invalid: [[220, 0.14, 'square'], [165, 0.2, 'square']],
  lock: [[330, 0.07, 'sine'], [247, 0.12, 'sine']],
  unlock: [[392, 0.07, 'sine'], [587, 0.14, 'sine']],
};
let lastAt = 0;
export function play(name) {
  if (!get('sound.on') || root.hasAttribute('data-mf-lowstim')) return false;
  const now = Date.now();
  if (now - lastAt < 60) return false; // never stack noise
  lastAt = now;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const vol = Math.max(0, Math.min(1, Number(get('sound.volume')) / 100));
    let t = ctx.currentTime + 0.01;
    (CUES[name] || CUES.click).forEach(([freq, len, type]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.18 * vol), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + len + 0.02); t += len * 0.9;
    });
    return true;
  } catch (e) { return false; }
}

define({ id: 'sound.on', group: 'sound', type: 'toggle', default: true, label: ['Action sounds', '操作音效'], info: ['Short, quiet cues for actions such as saving, opening a panel or an invalid file. They never replace the visible message, and Low stimulation mutes them.', '儲存、開啟面板或無效檔案等操作會有簡短、輕柔嘅提示音。音效唔會取代畫面訊息，低刺激模式會令佢靜音。'] });
define({ id: 'sound.volume', group: 'sound', type: 'range', min: 0, max: 100, step: 5, default: 40, unit: '%', label: ['Sound volume', '音效音量'], info: ['Only changes this site. Your device volume is not touched.', '只改呢個網站嘅音量，唔會改你裝置嘅音量。'] });
define({ id: 'sound.test', group: 'sound', type: 'action', label: ['Play a test sound', '播放測試音效'], info: ['Plays the success cue once at the current volume.', '用而家嘅音量播放一次成功提示音。'], run() { play('success'); } });
