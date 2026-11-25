/* A short first-visit welcome: language, how playful, comfort. Back and Next, saved progress, skippable, keyboard friendly. */
import { h, bi, $, define, get, set, store, pick, say, dialog, setLanguage, lang } from './core.js';
import { MSG } from './strings.js';
import { notify } from './notify.js';
import { setSchool } from './modes.js';

export function openWelcome() {
  let step = store.get('welcome.step', 0); const body = h('div', { class: 'mf-wiz' }); let d;
  const radio = (name, v, en, zh, on, cb) => h('label', { class: 'mf-flag' }, h('input', { type: 'radio', name, value: v, checked: on, onchange: () => cb(v) }), h('span', { html: bi(en, zh) }));
  const steps = [
    () => [h('p', { html: bi('Pick the language. You can change it any time in Settings.', '揀語言，之後隨時可以喺設定改。') }), radio('wl', 'en', 'English', 'English', lang() === 'en', setLanguage), radio('wl', 'zh', 'Cantonese', '廣東話', lang() === 'zh', setLanguage), radio('wl', 'both', 'Both together', '兩種一齊顯示', lang() === 'both', setLanguage)],
    () => { const mk = (id, en, zh) => { const o = h('output', {}, String(get(id))); return h('label', { class: 'mf-kctl' }, h('span', { html: bi(en, zh) }), h('input', { type: 'range', min: 1, max: 5, step: 1, value: get(id), oninput: (e) => { set(id, Number(e.target.value)); o.textContent = e.target.value; prev(); } }), o); }; const pv = h('p', { class: 'mf-preview', 'aria-live': 'polite' }); const prev = () => { const m = say(MSG.saved); pv.textContent = m.en + '  ' + m.zh; }; prev();
      return [h('p', { html: bi('The site can be playful. It changes the tone of messages only, never the facts. 1 is plain, 5 is playful.', '網站可以好玩啲。只會改變訊息語氣，唔會改變事實。1 係平實，5 係好玩。') }), mk('funny.en', 'English funny level', '英文幽默程度'), mk('funny.zh', 'Cantonese funny level', '廣東話幽默程度'), pv,
        h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', checked: get('dialog.emoji') !== false, onchange: (e) => set('dialog.emoji', e.target.checked) }), h('span', { html: bi('Show one decorative emoji in dialog titles', '喺對話框標題顯示一個裝飾表情') }))]; },
    () => [h('p', { html: bi('Comfort options. Everything here is optional and can be changed later.', '舒適選項，全部可選，之後可以更改。') }), h('label', { class: 'mf-kctl' }, h('span', { html: bi('Text size', '文字大小') }), h('input', { type: 'range', min: 85, max: 170, step: 5, value: get('a11y.text'), oninput: (e) => set('a11y.text', Number(e.target.value)) })),
      h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', checked: !!get('adhd.lowstim'), onchange: (e) => set('adhd.lowstim', e.target.checked) }), h('span', { html: bi('Low stimulation (no animation or sound)', '低刺激（冇動畫同音效）') })),
      h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', checked: !!get('school'), onchange: (e) => { setSchool(e.target.checked); } }), h('span', { html: bi('School mode (plain English only)', '學校模式（只用簡單英文）') }))],
    () => [h('p', { html: bi('All set. Press Ctrl+Shift+F any time to search every page and setting. Press ? to see the shortcuts.', '搞掂。隨時按 Ctrl+Shift+F 可以搜尋所有頁面同設定，按 ? 可以睇快速鍵。') })],
  ];
  function draw() {
    body.textContent = ''; body.append(h('p', { class: 'mf-hint' }, pick(`Step ${step + 1} of ${steps.length}`, `第 ${step + 1} 步，共 ${steps.length} 步`)), ...steps[step]()); store.set('welcome.step', step);
    const f = d.querySelector('.mf-dfoot'); f.textContent = '';
    f.append(h('button', { type: 'button', class: 'mf-btn text', html: bi('Skip', '略過'), onclick: () => { store.set('onboarded', true); d.close(); } }), step > 0 ? h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Back', '返回'), onclick: () => { step--; draw(); } }) : '',
      h('button', { type: 'button', class: 'mf-btn filled', html: step === steps.length - 1 ? bi('Finish', '完成') : bi('Next', '下一步'), onclick: () => { if (step === steps.length - 1) { store.set('onboarded', true); store.del('welcome.step'); d.close(); } else { step++; draw(); } } }));
  }
  d = dialog({ id: 'mf-welcome', titleEn: 'Welcome', titleZh: '歡迎', body, actions: [{ en: 'x', zh: 'x' }] }); draw();
}
define({ id: 'welcome.open', group: 'voice', type: 'action', label: ['Show the welcome steps again', '再次顯示歡迎步驟'], info: ['Opens the short first-visit setup: language, how playful the site sounds, and comfort options.', '開啟首次到訪嘅簡短設定：語言、網站幾好玩，同舒適選項。'], run: openWelcome });
export function maybeWelcome() { if (!store.get('onboarded', false) && !$('dialog[open]')) setTimeout(() => { if (!$('dialog[open]')) openWelcome(); }, 700); }
