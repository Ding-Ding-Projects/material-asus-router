/* Material Asus Router documentation site: preferences, search and the regular expression builder. */
(function () {
  'use strict';
  var root = document.documentElement;
  var CFG = window.__MAR || { root: './', index: 'search-index.js' };
  var DICT = window.__I18N || {};
  root.classList.add('js');

  function store(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* storage may be blocked */ } }
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---------- language ----------
  function lang() { return root.getAttribute('data-lang') || 'en'; }
  function tr(key, vars) {
    var e = DICT[key];
    if (!e) return key;
    var out = lang() === 'zh' ? e.zh : lang() === 'both' ? e.en + ' / ' + e.zh : e.en;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.split('{' + k + '}').join(vars[k]); });
    return out;
  }
  function trParts(key, vars) {
    var e = DICT[key] || { en: key, zh: key };
    var fix = function (s) { Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); return s; };
    return { en: fix(e.en), zh: fix(e.zh) };
  }
  function trHtml(key, vars) {
    var p = trParts(key, vars);
    return '<span class="bi"><span class="en">' + esc(p.en) + '</span><span class="zh" lang="zh-HK">' + esc(p.zh) + '</span></span>';
  }
  function applyAttrs() {
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i > 0) el.setAttribute(pair.slice(0, i), tr(pair.slice(i + 1)));
      });
    });
  }
  function setLang(value) {
    root.setAttribute('data-lang', value);
    root.setAttribute('lang', value === 'zh' ? 'zh-HK' : 'en');
    store('mar.lang', value);
    applyAttrs();
    document.dispatchEvent(new CustomEvent('mar:lang'));
  }
  window.MAR = { tr: tr, trHtml: trHtml, trParts: trParts, lang: lang, esc: esc, load: load, store: store };

  // ---------- settings ----------
  var HUES = [255, 295, 340, 25, 70, 150, 195];
  function hexToHue(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return null;
    var lin = function (c) { c = parseInt(c, 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    var r = lin(m[1]), g = lin(m[2]), b = lin(m[3]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var a = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
    var bb = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
    var hue = Math.atan2(bb, a) * 180 / Math.PI;
    return Math.round((hue + 360) % 360);
  }
  function setHue(h) { root.style.setProperty('--h', String(h)); store('mar.hue', String(h)); syncSwatches(); }
  function syncSwatches() {
    var current = parseInt(getComputedStyle(root).getPropertyValue('--h'), 10);
    $$('#swatches .swatch').forEach(function (b) { b.setAttribute('aria-checked', String(parseInt(b.getAttribute('data-h'), 10) === current)); });
  }
  function setTheme(v) { root.setAttribute('data-theme', v); store('mar.theme', v); }
  function setMotion(v) { root.setAttribute('data-motion', v); store('mar.motion', v); }

  var dialog = $('#settings');
  var swatchBox = $('#swatches');
  if (swatchBox) {
    HUES.forEach(function (h, n) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.setAttribute('role', 'radio'); b.setAttribute('data-h', String(h));
      b.style.setProperty('--sw', String(h)); b.setAttribute('aria-label', tr('settings.swatch') + ' ' + (n + 1));
      b.addEventListener('click', function () { setHue(h); });
      swatchBox.appendChild(b);
    });
    syncSwatches();
  }
  function syncRadios() {
    ['lang', 'theme', 'motion'].forEach(function (name) {
      var value = root.getAttribute('data-' + name);
      $$('input[name="' + name + '"]').forEach(function (r) { r.checked = r.value === value; });
    });
  }
  $$('#settings input[name="lang"]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setLang(r.value); }); });
  $$('#settings input[name="theme"]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setTheme(r.value); }); });
  $$('#settings input[name="motion"]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setMotion(r.value); }); });
  var custom = $('#accent-custom');
  if (custom) custom.addEventListener('input', function () { var h = hexToHue(custom.value); if (h !== null) setHue(h); });
  var resetBtn = $('#settings-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    ['mar.theme', 'mar.motion', 'mar.hue', 'mar.rxflags'].forEach(function (k) { store(k, null); });
    root.style.removeProperty('--h');
    setTheme('system'); setMotion('full'); setLang(/^zh/i.test(navigator.language || '') ? 'zh' : 'en');
    syncRadios(); syncSwatches();
  });
  var openBtn = $('#open-settings');
  if (openBtn && dialog) openBtn.addEventListener('click', function () {
    syncRadios(); syncSwatches();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  });
  if (dialog) dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  applyAttrs();

  // ---------- copy buttons ----------
  function flash(btn, label) {
    var span = btn.querySelector('.copy-label');
    btn.classList.add('done');
    if (span) { span.textContent = tr('copy.done'); }
    else { var old = btn.textContent; btn.textContent = tr('copy.done'); setTimeout(function () { btn.textContent = old; }, 1400); }
    setTimeout(function () { btn.classList.remove('done'); if (span) span.textContent = tr('copy'); }, 1400);
  }
  function copyText(text, btn) {
    var done = function () { flash(btn); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignored */ }
    document.body.removeChild(ta);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-copy], [data-copy-code]') : null;
    if (!b) return;
    if (b.hasAttribute('data-copy')) { var t = $(b.getAttribute('data-copy')); if (t) copyText(t.textContent, b); }
    else { var code = b.closest('figure').querySelector('code'); if (code) copyText(code.textContent, b); }
  });
  $$('button[data-copy-code]').forEach(function (b) { b.textContent = tr('copy'); });
  document.addEventListener('mar:lang', function () { $$('button[data-copy-code]').forEach(function (b) { b.textContent = tr('copy'); }); });

  // ---------- reveal on scroll ----------
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    setTimeout(function () { reveals.forEach(function (el) { el.classList.add('in'); }); }, 4000);
  } else reveals.forEach(function (el) { el.classList.add('in'); });

  // collapse the article table of contents on narrow screens
  var tocWrap = $('.toc-wrap');
  if (tocWrap && window.matchMedia && window.matchMedia('(max-width: 1000px)').matches) tocWrap.removeAttribute('open');

  // ---------- search and regular expression builder ----------
  var q = $('#q'), modeBtn = $('#q-mode'), clearBtn = $('#q-clear');
  var rxPanel = $('#rx'), rxToggle = $('#rx-toggle'), rxPattern = $('#rx-pattern'), rxStatus = $('#rx-status');
  var rxSample = $('#rx-sample'), rxSampleOut = $('#rx-sample-out'), rxExplain = $('#rx-explain'), rxTokens = $('#rx-tokens'), rxFlagsView = $('#rx-flags-view');
  var panel = $('#results'), list = $('#results-list'), summary = $('#results-summary');
  if (!q || !panel) return;

  var state = { mode: 'text', flags: { g: false, i: true, m: false, s: false, u: false } };
  try { var savedFlags = JSON.parse(load('mar.rxflags', 'null')); if (savedFlags) state.flags = Object.assign(state.flags, savedFlags); } catch (e) { /* ignored */ }
  var index = null, indexState = 'idle', worker = null, seq = 0, pending = {};

  function flagString() { return ['g', 'i', 'm', 's', 'u'].filter(function (f) { return state.flags[f]; }).join(''); }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

  function loadIndex(cb) {
    if (index) return cb(true);
    if (indexState === 'loading') { document.addEventListener('mar:index', function once() { document.removeEventListener('mar:index', once); cb(!!index); }); return; }
    if (window.__SEARCH_INDEX) { index = window.__SEARCH_INDEX; return cb(true); }
    indexState = 'loading';
    var s = document.createElement('script');
    s.src = CFG.index;
    s.onload = function () { index = window.__SEARCH_INDEX || []; indexState = 'ready'; document.dispatchEvent(new CustomEvent('mar:index')); cb(true); };
    s.onerror = function () { indexState = 'failed'; document.dispatchEvent(new CustomEvent('mar:index')); cb(false); };
    document.head.appendChild(s);
  }

  var WORKER_SOURCE = [
    'var docs=[];',
    'function run(m){var re;try{re=new RegExp(m.pattern,m.flags.replace(/g/g,"")+"g");}catch(e){return {id:m.id,error:String(e.message||e)};}',
    ' var out=[];for(var i=0;i<docs.length;i++){var d=docs[i];var text=d.x+"\\n"+d.y;var hits=[],count=0,mm;',
    '  re.lastIndex=0;while(count<60&&(mm=re.exec(text))){if(mm[0]===""){re.lastIndex++;continue;}count++;if(hits.length<4)hits.push([mm.index,mm[0].length]);}',
    '  re.lastIndex=0;var th=re.test(d.t+" "+d.z+" "+d.s);',
    '  if(count||th)out.push({i:i,count:count,title:th,hits:hits});}',
    ' out.sort(function(a,b){return (b.title-a.title)||(b.count-a.count);});return {id:m.id,results:out.slice(0,40),total:out.length};}',
    'function sample(m){var re;try{re=new RegExp(m.pattern,m.flags.replace(/g/g,"")+"g");}catch(e){return {id:m.id,error:String(e.message||e)};}',
    ' var hits=[],mm,text=m.text.slice(0,5000);while(hits.length<300&&(mm=re.exec(text))){if(mm[0]===""){re.lastIndex++;continue;}hits.push([mm.index,mm[0].length]);if(!/g/.test(m.flags))break;}return {id:m.id,hits:hits,text:text};}',
    'onmessage=function(e){var m=e.data;if(m.type==="index"){docs=m.docs;return;}postMessage(m.type==="sample"?sample(m):run(m));};'
  ].join('\n');

  function makeWorker() {
    try {
      var url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
      var w = new Worker(url);
      w.postMessage({ type: 'index', docs: index.map(function (d) { return { t: d.t, z: d.z, s: d.s, x: d.x, y: d.y }; }) });
      return w;
    } catch (e) { return null; }
  }

  // Run a bounded job. The worker is stopped if it does not answer in time, so a runaway pattern cannot hang the page.
  function job(msg, ms, cb) {
    var id = ++seq; msg.id = id;
    if (!worker) worker = makeWorker();
    if (!worker) { cb(fallbackJob(msg)); return; }
    var timer = setTimeout(function () {
      delete pending[id];
      try { worker.terminate(); } catch (e) { /* ignored */ }
      worker = null;
      cb({ slow: true });
    }, ms);
    pending[id] = function (data) { clearTimeout(timer); cb(data); };
    worker.onmessage = function (e) { var f = pending[e.data.id]; if (f) { delete pending[e.data.id]; f(e.data); } };
    worker.onerror = function () { clearTimeout(timer); delete pending[id]; worker = null; cb(fallbackJob(msg)); };
    worker.postMessage(msg);
  }
  function fallbackJob(msg) {
    // Only used when workers are blocked: refuse long patterns and stop after a time budget.
    if (msg.pattern.length > 200) return { slow: true };
    var re; try { re = new RegExp(msg.pattern, msg.flags.replace(/g/g, '') + 'g'); } catch (e) { return { id: msg.id, error: String(e.message || e) }; }
    var started = performance.now();
    if (msg.type === 'sample') {
      var hits = [], mm, text = msg.text.slice(0, 5000);
      while (hits.length < 300 && (mm = re.exec(text)) && performance.now() - started < 250) { if (mm[0] === '') { re.lastIndex++; continue; } hits.push([mm.index, mm[0].length]); if (msg.flags.indexOf('g') < 0) break; }
      return { id: msg.id, hits: hits, text: text };
    }
    var out = [];
    for (var i = 0; i < index.length; i++) {
      if (performance.now() - started > 250) return { slow: true };
      var d = index[i], t = d.x + '\n' + d.y, h = [], c = 0;
      re.lastIndex = 0;
      while (c < 60 && (mm = re.exec(t))) { if (mm[0] === '') { re.lastIndex++; continue; } c++; if (h.length < 4) h.push([mm.index, mm[0].length]); }
      re.lastIndex = 0;
      var th = re.test(d.t + ' ' + d.z + ' ' + d.s);
      if (c || th) out.push({ i: i, count: c, title: th, hits: h });
    }
    out.sort(function (a, b) { return (b.title - a.title) || (b.count - a.count); });
    return { id: msg.id, results: out.slice(0, 40), total: out.length };
  }

  function titleHtml(d) {
    var z = d.z || d.t;
    if (lang() === 'zh') return esc(z);
    if (lang() === 'both' && z !== d.t) return esc(d.t) + ' / ' + esc(z);
    return esc(d.t);
  }
  function sectionLabel(d) { var c = d.c || {}; return lang() === 'zh' ? c.zh : lang() === 'both' ? c.en + ' / ' + c.zh : c.en; }
  function kindLabel(k) { return tr('kind.' + (k === 'article' || k === 'wiki' ? k : 'page')); }
  function snippet(text, hits) {
    if (!text) return '';
    var first = hits && hits.length ? hits[0] : [0, 0];
    var start = Math.max(0, first[0] - 60), end = Math.min(text.length, first[0] + first[1] + 110);
    var html = '', pos = start;
    (hits || []).filter(function (h) { return h[0] >= start && h[0] + h[1] <= end; }).forEach(function (h) {
      if (h[0] < pos) return;
      html += esc(text.slice(pos, h[0])) + '<mark>' + esc(text.slice(h[0], h[0] + h[1])) + '</mark>';
      pos = h[0] + h[1];
    });
    html += esc(text.slice(pos, end));
    return (start > 0 ? '… ' : '') + html.replace(/\n+/g, ' ') + (end < text.length ? ' …' : '');
  }

  function showResults(items, total, note) {
    panel.hidden = false;
    q.setAttribute('aria-expanded', 'true');
    summary.textContent = note || (total ? tr('results.count', { n: total }) + (total > items.length ? ' ' + tr('results.limit', { n: items.length }) : '') : tr('results.none'));
    list.innerHTML = items.map(function (r) {
      var d = index[r.i];
      var text = d.x + '\n' + d.y;
      var snip = r.snip !== undefined ? r.snip : snippet(text, r.hits);
      if (!snip) snip = esc(d.s || '');
      return '<li><a href="' + esc(CFG.root + d.u) + '"><span class="r-title">' + titleHtml(d) + '</span><span class="r-meta">' + esc(kindLabel(d.k)) + ' · ' + esc(sectionLabel(d)) + '</span><p class="r-snippet">' + snip + '</p></a></li>';
    }).join('');
  }
  function showMessage(text) { panel.hidden = false; summary.textContent = text; list.innerHTML = ''; }
  function hideResults() { panel.hidden = true; q.setAttribute('aria-expanded', 'false'); }

  function textSearch(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var out = [];
    index.forEach(function (d, i) {
      var head = (d.t + ' ' + d.z + ' ' + d.s).toLowerCase();
      var body = (d.x + '\n' + d.y).toLowerCase();
      var ok = terms.every(function (t) { return head.indexOf(t) >= 0 || body.indexOf(t) >= 0; });
      if (!ok) return;
      var score = 0, hits = [];
      terms.forEach(function (t) { if (head.indexOf(t) >= 0) score += 10; var p = body.indexOf(t); if (p >= 0) { score += 1; hits.push([p, t.length]); } });
      hits.sort(function (a, b) { return a[0] - b[0]; });
      out.push({ i: i, hits: hits.slice(0, 4), score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  var debounce = null, lastRun = 0;
  function runSearch() {
    var value = q.value;
    clearBtn.hidden = !value;
    if (!value.trim()) { hideResults(); if (state.mode === 'regex') updateBuilder(); return; }
    var ticket = ++lastRun;
    showMessage(tr('results.loading'));
    loadIndex(function (ok) {
      if (ticket !== lastRun) return;
      if (!ok) { showMessage(tr('results.noindex')); return; }
      if (state.mode === 'text') {
        var found = textSearch(value);
        showResults(found.slice(0, 30), found.length);
      } else {
        job({ type: 'search', pattern: value, flags: flagString() }, 500, function (res) {
          if (ticket !== lastRun) return;
          if (res.slow) { showMessage(tr('results.slow')); return; }
          if (res.error) { showMessage(tr('results.invalid') + ' ' + res.error); return; }
          showResults(res.results, res.total);
        });
      }
    });
  }
  function schedule() { clearTimeout(debounce); debounce = setTimeout(runSearch, 160); }

  // ----- regex explanation -----
  var SIMPLE = { d: 'digit', D: 'ndigit', w: 'word', W: 'nword', s: 'space', S: 'nspace', b: 'wordb', B: 'nwordb', t: 'ctrl', n: 'ctrl', r: 'ctrl' };
  function explain(p) {
    var items = [], i = 0, lit = '';
    function flushLit() { if (lit) { items.push([lit, 'lit']); lit = ''; } }
    while (i < p.length && items.length < 80) {
      var c = p[i];
      if (c === '\\') {
        var n = p[i + 1] || '';
        flushLit();
        if (n === 'p' || n === 'P') { var close = p.indexOf('}', i); var tok = close > 0 ? p.slice(i, close + 1) : p.slice(i, i + 2); items.push([tok, 'prop']); i += tok.length; continue; }
        if (/[1-9]/.test(n)) { items.push(['\\' + n, 'back']); i += 2; continue; }
        if (SIMPLE[n]) { items.push(['\\' + n, SIMPLE[n]]); i += 2; continue; }
        items.push(['\\' + n, 'escape']); i += 2; continue;
      }
      if (c === '[') {
        flushLit();
        var j = i + 1; if (p[j] === '^') j++;
        if (p[j] === ']') j++;
        while (j < p.length && p[j] !== ']') { if (p[j] === '\\') j++; j++; }
        var cls = p.slice(i, j + 1);
        items.push([cls, p[i + 1] === '^' ? 'nclass' : 'class']); i = j + 1; continue;
      }
      if (c === '(') {
        flushLit();
        var rest = p.slice(i);
        var m;
        if ((m = /^\(\?<([A-Za-z_]\w*)>/.exec(rest))) { items.push([m[0], 'named']); i += m[0].length; continue; }
        if ((m = /^\(\?(:|=|!|<=|<!)/.exec(rest))) { items.push([m[0], { ':': 'ncgroup', '=': 'look', '!': 'nlook', '<=': 'lookb', '<!': 'nlookb' }[m[1]]]); i += m[0].length; continue; }
        items.push(['(', 'group']); i++; continue;
      }
      if (c === ')') { flushLit(); i++; continue; }
      if (c === '|') { flushLit(); items.push(['|', 'alt']); i++; continue; }
      if (c === '.') { flushLit(); items.push(['.', 'any']); i++; continue; }
      if (c === '^') { flushLit(); items.push(['^', 'start']); i++; continue; }
      if (c === '$') { flushLit(); items.push(['$', 'end']); i++; continue; }
      if (c === '*' || c === '+' || c === '?') {
        flushLit();
        var prev = items.length ? items[items.length - 1][1] : '';
        if (c === '?' && (prev === 'star' || prev === 'plus' || prev === 'opt' || prev === 'quant')) items.push(['?', 'lazy']);
        else items.push([c, c === '*' ? 'star' : c === '+' ? 'plus' : 'opt']);
        i++; continue;
      }
      if (c === '{') {
        var qm = /^\{\d+(,\d*)?\}/.exec(p.slice(i));
        if (qm) { flushLit(); items.push([qm[0], 'quant']); i += qm[0].length; continue; }
      }
      lit += c; i++;
    }
    flushLit();
    return items;
  }

  function updateBuilder() {
    if (!rxPanel || rxPanel.hidden) return;
    var p = rxPattern.value;
    rxFlagsView.textContent = flagString();
    rxStatus.className = 'rx-status';
    if (!p) { rxStatus.textContent = tr('rx.empty'); rxExplain.innerHTML = ''; rxSampleOut.textContent = ''; return; }
    try { new RegExp(p, flagString()); rxStatus.textContent = tr('rx.valid'); rxStatus.className = 'rx-status good'; }
    catch (e) { rxStatus.textContent = tr('rx.invalid') + ' ' + e.message; rxStatus.className = 'rx-status bad'; rxExplain.innerHTML = ''; rxSampleOut.textContent = ''; return; }
    rxExplain.innerHTML = explain(p).map(function (it) {
      var label = tr('rx.x.' + it[1]);
      return '<li><code>' + esc(it[0]) + '</code><span>' + esc(label) + (it[1] === 'lit' ? '' : '') + '</span></li>';
    }).join('');
    var text = rxSample.value;
    if (!text) { rxSampleOut.textContent = ''; return; }
    job({ type: 'sample', pattern: p, flags: flagString(), text: text }, 400, function (res) {
      if (res.slow) { rxSampleOut.textContent = tr('results.slow'); return; }
      if (res.error) return;
      var html = '', pos = 0;
      res.hits.forEach(function (h) { if (h[0] < pos) return; html += esc(res.text.slice(pos, h[0])) + '<mark>' + esc(res.text.slice(h[0], h[0] + h[1])) + '</mark>'; pos = h[0] + h[1]; });
      html += esc(res.text.slice(pos));
      rxSampleOut.innerHTML = html + '<div class="muted small">' + esc(res.hits.length ? tr('rx.matches', { n: res.hits.length }) : tr('rx.nomatch')) + '</div>';
    });
  }

  function setMode(mode, carry) {
    var before = state.mode;
    state.mode = mode;
    modeBtn.setAttribute('aria-pressed', String(mode === 'regex'));
    if (carry && before !== mode) {
      if (mode === 'regex') { q.value = escapeRegExp(q.value); }
      else if (rxPattern.value === q.value) { /* keep the pattern text as typed */ }
    }
    if (mode === 'regex') rxPattern.value = q.value;
    updateBuilder();
    if (q.value.trim()) runSearch();
  }

  var TOKENS = [
    ['\\d', '\\d', 'digit'], ['\\w', '\\w', 'word'], ['\\s', '\\s', 'space'], ['.', '.', 'any'], ['^', '^', 'start'], ['$', '$', 'end'], ['\\b', '\\b', 'wordb'],
    ['( )', '()', 'group'], ['(?: )', '(?:)', 'ncgroup'], ['|', '|', 'alt'], ['[ ]', '[]', 'class'], ['[^ ]', '[^]', 'nclass'],
    ['*', '*', 'star'], ['+', '+', 'plus'], ['?', '?', 'opt'], ['{2,5}', '{2,5}', 'range'], ['*?', '*?', 'lazy'], ['(?= )', '(?=)', 'look'], ['(?! )', '(?!)', 'nlook'], ['\\1', '\\1', 'back']
  ];
  function buildTokens() {
    if (!rxTokens) return;
    rxTokens.innerHTML = '';
    TOKENS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<code>' + esc(t[0]) + '</code><span>' + esc(tr('rx.t.' + t[2])) + '</span>';
      b.addEventListener('click', function () {
        var field = rxPattern, s = field.selectionStart, e = field.selectionEnd;
        var ins = t[1], caret = ins.length;
        if (ins.length >= 2 && /[\])]$/.test(ins) && ins !== '\\b') caret = ins.length - 1;
        if (/^\{/.test(ins)) caret = ins.length;
        var selected = field.value.slice(s, e);
        if (selected && caret < ins.length) { ins = ins.slice(0, caret) + selected + ins.slice(caret); caret += selected.length; }
        field.value = field.value.slice(0, s) + ins + field.value.slice(e);
        field.focus(); field.setSelectionRange(s + caret, s + caret);
        field.dispatchEvent(new Event('input'));
      });
      rxTokens.appendChild(b);
    });
  }

  // wiring
  q.addEventListener('input', function () { if (state.mode === 'regex') { rxPattern.value = q.value; updateBuilder(); } schedule(); });
  q.addEventListener('focus', function () { loadIndex(function () {}); if (q.value.trim() && panel.hidden) runSearch(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!panel.hidden) { hideResults(); e.preventDefault(); } }
    else if (e.key === 'ArrowDown') { var a = $('a', list); if (a) { a.focus(); e.preventDefault(); } }
    else if (e.key === 'Enter') { var f = $('a', list); if (f) { window.location.href = f.href; } }
  });
  list.addEventListener('keydown', function (e) {
    var links = $$('a', list), i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < links.length - 1) { links[i + 1].focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { if (i > 0) links[i - 1].focus(); else q.focus(); e.preventDefault(); }
    else if (e.key === 'Escape') { hideResults(); q.focus(); }
  });
  clearBtn.addEventListener('click', function () { q.value = ''; rxPattern.value = ''; clearBtn.hidden = true; hideResults(); updateBuilder(); q.focus(); });
  $('#results-close').addEventListener('click', hideResults);
  modeBtn.addEventListener('click', function () { setMode(state.mode === 'regex' ? 'text' : 'regex', true); });
  rxToggle.addEventListener('click', function () {
    var open = rxPanel.hidden;
    rxPanel.hidden = !open;
    rxToggle.setAttribute('aria-expanded', String(open));
    if (open) { if (state.mode !== 'regex') setMode('regex', true); else { rxPattern.value = q.value; updateBuilder(); } rxPattern.focus(); }
  });
  rxPattern.addEventListener('input', function () { if (state.mode === 'regex') { q.value = rxPattern.value; clearBtn.hidden = !q.value; schedule(); } updateBuilder(); });
  rxSample.addEventListener('input', updateBuilder);
  $$('[data-flag]').forEach(function (box) {
    box.checked = !!state.flags[box.getAttribute('data-flag')];
    box.addEventListener('change', function () { state.flags[box.getAttribute('data-flag')] = box.checked; store('mar.rxflags', JSON.stringify(state.flags)); updateBuilder(); if (state.mode === 'regex' && q.value.trim()) schedule(); });
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); q.select(); }
  });
  document.addEventListener('click', function (e) { if (!panel.hidden && !e.target.closest('.appbar')) hideResults(); });
  document.addEventListener('mar:lang', function () { buildTokens(); updateBuilder(); if (!panel.hidden && q.value.trim()) runSearch(); });
  buildTokens();
  rxFlagsView.textContent = flagString();
})();
