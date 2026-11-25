/* Home page interactions: the change-flow demonstration, the guard diagram, the feature filter, count-up numbers, the hero mock and the scroll story. */
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

  // ---------- visual layer: motion-aware helpers, count-up, hero mock, story, tile badges ----------
  var rootEl = document.documentElement;
  var fullMotion = function () {
    var reduceOs = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return rootEl.getAttribute('data-motion') === 'full' && !reduceOs;
  };

  // numbers in the stats strip come from the real feature inventory, never from hand-typed counts
  var featureItems = $$('.feature');
  var counts = {
    features: featureItems.length,
    areas: $$('.feature-group').length,
    ready: featureItems.filter(function (li) { return li.getAttribute('data-status') === 'ready'; }).length
  };
  $$('[data-from]').forEach(function (el) { el.setAttribute('data-count', String(counts[el.getAttribute('data-from')] || 0)); });
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (!fullMotion() || target === 0) { el.textContent = String(target); return; }
    var start = null, dur = 1100;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = String(Math.round(target * e));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var nums = $$('.num[data-count], [data-countup]');
  nums.forEach(function (el) {
    if (el.hasAttribute('data-countup')) el.setAttribute('data-count', el.getAttribute('data-countup'));
    el.textContent = el.getAttribute('data-count'); // the true value first, so nothing depends on the animation
  });
  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); seen.unobserve(e.target); } });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { seen.observe(el); });
  }

  // hero mock: cycles preview, timer armed, link check and applied, only while visible and only with full motion
  var mock = $('#mock');
  if (mock) {
    var phase = 3, tick = null, inView = true;
    var setPhase = function (n) { phase = n; mock.setAttribute('data-phase', String(n)); };
    var stopMock = function () { if (tick) { clearInterval(tick); tick = null; } };
    var runMock = function () {
      stopMock();
      if (!fullMotion() || !inView || document.visibilityState === 'hidden') { setPhase(3); return; }
      setPhase(0);
      tick = setInterval(function () { setPhase((phase + 1) % 4); }, 2600);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; runMock(); }, { threshold: 0.2 }).observe(mock);
    } else runMock();
    new MutationObserver(runMock).observe(rootEl, { attributes: true, attributeFilter: ['data-motion'] });
    document.addEventListener('visibilitychange', runMock);
  }

  // "how a safe change works": the step in view drives the picture beside it
  var story = $('#story-body');
  if (story && 'IntersectionObserver' in window) {
    var stepEls = $$('.story-step', story);
    var choose = function (el) {
      story.setAttribute('data-step', el.getAttribute('data-s'));
      stepEls.forEach(function (o) { o.classList.toggle('on', o === el); });
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) choose(e.target); });
    }, { rootMargin: '-35% 0px -45% 0px', threshold: 0 });
    stepEls.forEach(function (s) {
      spy.observe(s);
      s.setAttribute('tabindex', '0');
      s.addEventListener('focus', function () { choose(s); });
    });
  }

  // tile badges read the real status from the full inventory below, so a tile can never claim more than its guide
  $$('.tile[data-feature]').forEach(function (tile) {
    var href = tile.getAttribute('data-feature');
    var match = $$('.feature-link').filter(function (a) { return a.getAttribute('href') === href; })[0];
    var badge = $('[data-badge]', tile), src = match && $('.badge', match);
    if (badge && src) { badge.className = 'tile-badge ' + src.className; badge.innerHTML = src.innerHTML; }
  });
})();
