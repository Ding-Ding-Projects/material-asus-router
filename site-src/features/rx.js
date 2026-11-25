/* A reusable search box with its own adjacent regular expression builder.
   Each instance keeps its own query, pattern, flags, validation and mode, and saves them under its own key. */
import { h, bi, store, pick, debounce, uid } from './core.js';

const TOKENS = [
  ['.', 'any character', '任何字元'], ['\\d', 'digit', '數字'], ['\\w', 'word character', '字詞字元'], ['\\s', 'whitespace', '空白'],
  ['^', 'start of line', '行首'], ['$', 'end of line', '行尾'], ['\\b', 'word boundary', '字詞邊界'], ['[abc]', 'one of a, b, c', 'a、b、c 其中之一'],
  ['(a|b)', 'a or b', 'a 或 b'], ['(?:x)', 'group without capture', '不捕獲分組'], ['x*', 'zero or more', '零個或以上'], ['x+', 'one or more', '一個或以上'],
  ['x?', 'optional', '可有可無'], ['x{2,4}', 'two to four', '兩至四個'], ['(?=x)', 'followed by', '後面係'], ['(?<=x)', 'preceded by', '前面係'],
];
const FLAGS = [['g', 'global', '全部'], ['i', 'ignore case', '唔分大細楷'], ['m', 'multiline', '多行'], ['s', 'dot matches newline', '點號包括換行'], ['u', 'unicode', 'Unicode']];
const BUDGET_MS = 40;

export function searchBox({ key, placeholder, onChange, compact }) {
  const saved = store.get('rx.' + key, { q: '', mode: 'text', pattern: '', flags: 'i', open: false });
  const st = { q: saved.q || '', mode: saved.mode || 'text', pattern: saved.pattern || '', flags: saved.flags || 'i', open: !!saved.open, valid: true, error: '' };
  const id = 'rx' + uid();
  const persist = () => store.set('rx.' + key, { q: st.q, mode: st.mode, pattern: st.pattern, flags: st.flags, open: st.open });
  const label = placeholder || pick('Search', '搜尋');
  const input = h('input', { type: 'search', class: 'mf-input', id: id + 'q', placeholder: label, autocomplete: 'off', spellcheck: 'false', 'aria-label': label, value: st.q });
  const modeBtn = h('button', { type: 'button', class: 'mf-chip', 'aria-pressed': String(st.mode === 'regex'), title: pick('Switch between plain text and regular expression', '切換純文字同正規表達式') });
  const bldBtn = h('button', { type: 'button', class: 'mf-chip', 'aria-expanded': String(st.open), 'aria-controls': id + 'b' }, h('span', { 'aria-hidden': 'true' }, '.*'), ' ', h('span', { html: bi('Regex builder', '正規表達式建構器') }));
  const status = h('p', { class: 'mf-rxstatus', role: 'status', 'aria-live': 'polite' });
  const pat = h('input', { type: 'text', class: 'mf-input mono', id: id + 'p', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': pick('Regular expression pattern', '正規表達式樣式'), value: st.pattern });
  const flagBox = h('div', { class: 'mf-flags', role: 'group', 'aria-label': pick('Flags', '旗標') }, FLAGS.map(([f, en, zh]) => {
    const cb = h('input', { type: 'checkbox', 'data-f': f }); cb.checked = st.flags.indexOf(f) >= 0;
    cb.addEventListener('change', () => { st.flags = FLAGS.map((x) => x[0]).filter((x) => (x === f ? cb.checked : st.flags.indexOf(x) >= 0)).join(''); sync(false); });
    return h('label', { class: 'mf-flag', title: en }, cb, h('span', {}, h('b', {}, f), ' ', h('span', { html: bi(en, zh) })));
  }));
  const sample = h('textarea', { class: 'mf-input mono', rows: 2, 'aria-label': pick('Sample text to test the pattern', '測試樣式嘅範例文字'), placeholder: pick('Sample text to try the pattern on', '輸入範例文字試用樣式') });
  const sampleOut = h('div', { class: 'mf-sample', 'aria-live': 'polite' });
  const tokens = h('div', { class: 'mf-tokens', role: 'group', 'aria-label': pick('Insert a token', '插入符號') }, TOKENS.map(([tok, en, zh]) => h('button', { type: 'button', class: 'mf-token', title: pick(en, zh), onclick: () => {
    const s = pat.selectionStart === null ? pat.value.length : pat.selectionStart; const e = pat.selectionEnd === null ? s : pat.selectionEnd;
    pat.value = pat.value.slice(0, s) + tok + pat.value.slice(e); st.pattern = pat.value; st.mode = 'regex'; pat.focus(); pat.setSelectionRange(s + tok.length, s + tok.length); sync(true);
  } }, tok)));
  const builder = h('div', { class: 'mf-rx', id: id + 'b', hidden: !st.open }, h('label', { for: id + 'p', class: 'mf-lab', html: bi('Pattern', '樣式') }), h('div', { class: 'mf-rxfield' }, h('span', { 'aria-hidden': 'true' }, '/'), pat, h('span', { 'aria-hidden': 'true' }, '/')), flagBox, tokens, status, sample, sampleOut);
  const el = h('div', { class: 'mf-search' + (compact ? ' compact' : '') }, h('div', { class: 'mf-searchrow' }, input, modeBtn, bldBtn), builder);

  let compiled = null;
  function compile() {
    st.valid = true; st.error = ''; compiled = null;
    if (st.mode !== 'regex') return;
    const src = st.pattern || st.q;
    if (!src) return;
    try { compiled = new RegExp(src, st.flags.replace('g', '')); } catch (e) { st.valid = false; st.error = String(e.message).replace(/^Invalid regular expression: /, ''); }
  }
  function render() {
    modeBtn.setAttribute('aria-pressed', String(st.mode === 'regex'));
    modeBtn.innerHTML = st.mode === 'regex' ? bi('Regex', '正規') : bi('Text', '文字');
    bldBtn.setAttribute('aria-expanded', String(st.open)); builder.hidden = !st.open;
    status.innerHTML = st.mode !== 'regex' ? bi('Plain text mode. Switch to Regex to use the pattern.', '純文字模式，切換去正規先會用樣式。')
      : st.valid ? bi('Valid pattern.', '樣式有效。') : `${bi('Not valid: ', '無效：')}${st.error.replace(/</g, '&lt;')}`;
    status.classList.toggle('bad', !st.valid && st.mode === 'regex');
    pat.setAttribute('aria-invalid', String(!st.valid)); input.setAttribute('aria-invalid', String(!st.valid));
    sampleOut.textContent = '';
    if (compiled && sample.value) {
      const g = new RegExp(compiled.source, compiled.flags + 'g'); let last = 0, m, n = 0; const t0 = performance.now(); const text = sample.value.slice(0, 2000);
      while ((m = g.exec(text)) && n < 200) {
        if (m[0] === '') { g.lastIndex++; continue; }
        if (performance.now() - t0 > BUDGET_MS) { sampleOut.append(pick(' (stopped: too slow)', '（已停止：太慢）')); break; }
        sampleOut.append(text.slice(last, m.index), h('mark', {}, m[0])); last = m.index + m[0].length; n++;
      }
      sampleOut.append(text.slice(last)); sampleOut.append(h('div', { class: 'mf-count' }, pick(`${n} match(es)`, `${n} 個符合`)));
    }
  }
  function sync(fromPattern) {
    if (fromPattern && st.mode === 'regex') { st.q = st.pattern; input.value = st.pattern; }
    compile(); render(); persist(); if (onChange) onChange(api);
  }
  input.addEventListener('input', debounce(() => { st.q = input.value; if (st.mode === 'regex') { st.pattern = input.value; pat.value = input.value; } sync(false); }, 90));
  pat.addEventListener('input', () => { st.pattern = pat.value; st.mode = 'regex'; sync(true); });
  sample.addEventListener('input', debounce(render, 60));
  modeBtn.addEventListener('click', () => { st.mode = st.mode === 'regex' ? 'text' : 'regex'; if (st.mode === 'regex' && !st.pattern) { st.pattern = st.q; pat.value = st.q; } sync(false); });
  bldBtn.addEventListener('click', () => { st.open = !st.open; if (st.open && st.mode !== 'regex') { st.mode = 'regex'; st.pattern = st.q; pat.value = st.q; } sync(false); if (st.open) pat.focus(); });
  compile(); render();

  const api = {
    el, input, state: st,
    /** True when the haystack matches the current query. Bounded to the first 6000 characters. */
    test(text) {
      const q = st.q.trim(); if (!q) return true;
      const hay = String(text).slice(0, 6000);
      if (st.mode === 'regex') { if (!compiled) return st.valid; try { return compiled.test(hay); } catch (e) { return false; } }
      return hay.toLowerCase().indexOf(q.toLowerCase()) >= 0;
    },
    focus() { input.focus(); input.select(); },
    clear() { st.q = ''; st.pattern = ''; input.value = ''; pat.value = ''; sync(false); },
  };
  return api;
}
