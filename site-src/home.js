/* Home page interactions: the change-flow demonstration, the guard diagram and the feature filter. */
(function () {
  'use strict';
  var M = window.MAR;
  if (!M) return;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ---------- change-flow demonstration (no network, no router) ----------
  var app = $('#demo-app');
  if (app) {
    var TOTAL = 90, SPEED = 6; // the demonstration counts down six times faster than the real timer
    var st = { phase: 'idle', left: TOTAL, timer: null, log: [], lost: false };
    var statusEl = $('#demo-status'), actions = $('#demo-actions'), gActions = $('#demo-guard-actions'), gNote = $('#demo-guard-note');
    var ring = $('#demo-ring'), secs = $('#demo-seconds'), logEl = $('#demo-log');
    var steps = $$('#demo-steps li');
    var nameNew = $('.diff-table .new'), nameOld = $('.diff-table .old');
    var CIRC = 2 * Math.PI * 52;
    ring.style.strokeDasharray = String(CIRC);

    function btn(cls, key, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.setAttribute('data-key', key); b.textContent = M.tr(key);
      b.addEventListener('click', fn);
      return b;
    }
    function addLog(key, kind) { st.log.push({ key: key, kind: kind || '' }); renderLog(); }
    function renderLog() {
      logEl.innerHTML = st.log.map(function (l) { return '<li class="' + l.kind + '">' + M.esc(M.tr(l.key)) + '</li>'; }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
    function stop() { if (st.timer) { clearInterval(st.timer); st.timer = null; } }
    function setPhase(phase) {
      st.phase = phase;
      app.setAttribute('data-state', phase === 'applied' || phase === 'undone' ? 'applied' : phase === 'reverted' ? 'reverted' : phase);
      render();
    }
    function render() {
      var p = st.phase;
      var stepIndex = p === 'idle' ? -1 : p === 'preview' ? 0 : p === 'armed' ? 1 : 2;
      steps.forEach(function (li, i) { li.classList.toggle('active', i === stepIndex); li.classList.toggle('done', i < stepIndex); });
      statusEl.textContent = M.tr('demo.st.' + (p === 'applied' ? 'applied' : p));
      nameNew.textContent = p === 'undone' ? 'HomeNet' : 'HomeNet-Fast';
      nameOld.textContent = 'HomeNet';
      actions.innerHTML = ''; gActions.innerHTML = '';
      if (p === 'idle') actions.appendChild(btn('filled-btn', 'demo.btn.preview', function () { addLog('demo.log.preview'); setPhase('preview'); }));
      if (p === 'preview') {
        actions.appendChild(btn('filled-btn', 'demo.btn.confirm', confirmApply));
        actions.appendChild(btn('text-btn', 'demo.btn.cancel', function () { addLog('demo.log.cancel'); setPhase('idle'); }));
      }
      if (p === 'applied') actions.appendChild(btn('tonal-btn', 'demo.btn.undo', function () { addLog('demo.log.undo', 'ok'); setPhase('undone'); }));
      if (p === 'applied' || p === 'reverted' || p === 'undone') actions.appendChild(btn('text-btn', 'demo.btn.reset', reset));
      if (p === 'armed') {
        gActions.appendChild(btn('filled-btn', 'demo.btn.reach', reached));
        gActions.appendChild(btn('tonal-btn', 'demo.btn.lose', lost));
      }
      gNote.textContent = M.tr(p === 'armed' ? 'demo.guard.armed' : p === 'applied' || p === 'undone' ? 'demo.guard.done' : p === 'reverted' ? 'demo.guard.fired' : 'demo.guard.idle');
      paintRing();
    }
    function paintRing() {
      secs.textContent = String(Math.max(0, Math.ceil(st.left)));
      var fraction = st.phase === 'armed' ? st.left / TOTAL : st.phase === 'applied' || st.phase === 'undone' ? 1 : 0;
      ring.style.strokeDashoffset = String(CIRC * (1 - fraction));
    }
    function confirmApply() {
      st.lost = false;
      addLog('demo.log.confirm');
      addLog('demo.log.arm', 'warn');
      addLog('demo.log.apply');
      st.left = TOTAL;
      setPhase('armed');
      stop();
      st.timer = setInterval(function () {
        st.left -= SPEED * 0.25;
        if (st.left <= 0) { st.left = 0; stop(); if (!st.lost) addLog('demo.log.lost', 'bad'); addLog('demo.log.revert', 'bad'); setPhase('reverted'); return; }
        paintRing();
      }, 250);
    }
    function reached() { stop(); addLog('demo.log.reach', 'ok'); st.left = TOTAL; setPhase('applied'); }
    function lost() {
      st.lost = true;
      addLog('demo.log.lost', 'bad');
      // the connection is gone: the only thing left is the timer on the router, which keeps running
      gActions.innerHTML = '';
    }
    function reset() { stop(); st.log = []; st.left = TOTAL; addLog('demo.log.reset'); setPhase('idle'); }
    document.addEventListener('mar:lang', function () { render(); renderLog(); });
    st.log = [];
    setPhase('idle');
  }

  // ---------- connection-loss guard diagram ----------
  var flow = $('#guard-diagram');
  if (flow) {
    var order = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6a', 'n6b'];
    var current = 'n1';
    var titleEl = $('#flow-title'), textEl = $('#flow-text');
    var nodes = $$('[data-node]', flow);
    var show = function (id) {
      current = id;
      nodes.forEach(function (n) { n.setAttribute('aria-pressed', String(n.getAttribute('data-node') === id)); });
      var k = id.replace('n', '');
      titleEl.textContent = M.tr('guard.n' + k);
      textEl.textContent = M.tr('guard.d' + k);
      $('#flow-prev').disabled = order.indexOf(id) === 0;
      $('#flow-next').disabled = order.indexOf(id) === order.length - 1;
    };
    nodes.forEach(function (n) { n.addEventListener('click', function () { show(n.getAttribute('data-node')); }); });
    $('#flow-prev').addEventListener('click', function () { show(order[Math.max(0, order.indexOf(current) - 1)]); });
    $('#flow-next').addEventListener('click', function () {
      var i = order.indexOf(current);
      show(current === 'n5' ? 'n6a' : order[Math.min(order.length - 1, i + 1)]);
    });
    document.addEventListener('mar:lang', function () { show(current); });
    show('n1');
  }

  // ---------- feature filter ----------
  var chips = $$('.filter-chip');
  if (chips.length) {
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        $$('.feature').forEach(function (li) { li.hidden = f !== 'all' && li.getAttribute('data-status') !== f; });
        $$('.feature-group').forEach(function (g) { g.classList.toggle('empty', !$$('.feature:not([hidden])', g).length); });
      });
    });
  }
})();
