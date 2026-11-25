// ADHD modes: five independent switches, all off by default. They change how the
// app is laid out and what it shows, never what it does. The wording is plain and
// factual: no streaks, no scores, no praise, and nothing here is medical advice.
//
//   Focus            hides the side rail, the tabs and the extra toolbar buttons. A
//                    "Show everything" button stays on screen, so nothing is out of reach.
//   Low stimulation  stops animation and transitions, calms the strongest colours and
//                    quietens sounds. It adds to the system's own reduced-motion setting.
//   Time awareness   shows the time now and how long this screen and this visit have lasted.
//   One thing at a time  shows one card of a long page at once, with Previous, Next and Show all.
//   Momentum         shows what has been done this visit and what is waiting, as plain counts.
//
// School mode does not switch these off: they are comfort settings, not extras.
// Kids mode does not exist in this app yet; when it does, these modes will apply on top of it.

export const MODES = ["focus", "low", "time", "one", "momentum"];
export const CLASS = { focus: "vx-adhd-focus", low: "vx-adhd-low", time: "vx-adhd-time", one: "vx-adhd-one", momentum: "vx-adhd-momentum" };

export const lowStimulationOn = (record) => Boolean(record.adhd.low);

// The cards of a page that "one thing at a time" steps through: the page's own
// direct cards, never its heading and never the pending-changes dock.
export const cardsOf = (root) => [...(root?.querySelectorAll?.(".page > .card, .page > .vx-panel > .card, .page > .grid > .card, .page > .grid2 > .card") ?? [])];

export function createAdhd({ doc = globalThis.document, ctx, getRecord, tr, onCounts }) {
  const { h } = ctx;
  const root = doc.documentElement;
  let timers = [];
  let observer = null;
  let screenSince = Date.now();
  let visitSince = Date.now();
  let index = 0;
  let showAll = false;
  let applied = 0;
  let elements = {};
  let offs = [];

  const minutes = (ms) => {
    const m = Math.floor(ms / 60000);
    return m < 1 ? tr("adhdLessThanMinute") : tr("adhdMinutes", { n: m });
  };

  function chrome() {
    const r = getRecord();
    root.classList.toggle(CLASS.focus, r.adhd.focus);
    root.classList.toggle(CLASS.low, r.adhd.low);
    root.classList.toggle(CLASS.time, r.adhd.time);
    root.classList.toggle(CLASS.one, r.adhd.one);
    root.classList.toggle(CLASS.momentum, r.adhd.momentum);
    draw();
  }

  function draw() {
    const r = getRecord();
    const body = doc.body;
    const keep = (key, make, on) => {
      if (on && !elements[key]) body.append((elements[key] = make()));
      if (!on && elements[key]) {
        elements[key].remove();
        elements[key] = null;
      }
    };
    keep("focus", () => h("button", { class: "btn f vx-focus-exit", onClick: () => onCounts?.exitFocus?.() }, tr("adhdShowEverything")), r.adhd.focus);
    keep("time", () => h("div", { class: "vx-time", role: "timer", "aria-live": "off" }), r.adhd.time);
    keep("momentum", () => h("div", { class: "vx-momentum", role: "status" }), r.adhd.momentum);
    tick();
    one();
  }

  function tick() {
    const r = getRecord();
    if (r.adhd.time && elements.time) {
      const now = new Date();
      elements.time.textContent = tr("adhdTime", { now: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }), screen: minutes(Date.now() - screenSince), visit: minutes(Date.now() - visitSince) });
    }
    if (r.adhd.momentum && elements.momentum) elements.momentum.textContent = tr("adhdMomentum", { done: applied, waiting: ctx.dock.count() });
  }

  // One thing at a time: hide every card but one, and give the way to the rest.
  function one() {
    const r = getRecord();
    const page = doc.querySelector("#content");
    doc.querySelectorAll(".vx-onebar").forEach((e) => e.remove());
    for (const card of doc.querySelectorAll("[data-vx-hidden]")) {
      card.hidden = false;
      card.removeAttribute("data-vx-hidden");
    }
    if (!r.adhd.one || !page || showAll) return;
    const cards = cardsOf(page);
    if (cards.length < 2) return;
    index = Math.min(index, cards.length - 1);
    cards.forEach((card, i) => {
      if (i !== index) {
        card.hidden = true;
        card.setAttribute("data-vx-hidden", "");
      }
    });
    const bar = h("div", { class: "vx-onebar", role: "group", "aria-label": tr("adhdOneLabel") },
      h("span", { class: "t2" }, tr("adhdOneOf", { i: index + 1, n: cards.length })),
      h("button", { class: "btn t sm", disabled: index === 0, onClick: () => { index--; one(); } }, tr("adhdPrevious")),
      h("button", { class: "btn t sm", disabled: index === cards.length - 1, onClick: () => { index++; one(); } }, tr("adhdNext")),
      h("button", { class: "btn o sm", onClick: () => { showAll = true; one(); } }, tr("adhdShowAll")));
    cards[index].before(bar);
  }

  function start() {
    stop();
    chrome();
    timers = [setInterval(tick, 10000)];
    const content = doc.querySelector("#content");
    if (content) {
      observer = new MutationObserver(() => {
        if (!observer) return;
        observer.disconnect();
        const fresh = Boolean(content.querySelector(".page")) && !content.querySelector("[data-vx-hidden]") && !content.querySelector(".vx-onebar");
        if (fresh) {
          index = 0;
          showAll = false;
          screenSince = Date.now();
        }
        one();
        tick();
        observer?.observe(content, { childList: true });
      });
      observer.observe(content, { childList: true });
    }
    offs = [ctx.bus.on("changed", () => { applied++; tick(); }), ctx.bus.on("dock", tick)];
  }

  function stop() {
    timers.forEach(clearInterval);
    timers = [];
    observer?.disconnect();
    observer = null;
    offs.forEach((f) => f());
    offs = [];
    for (const key of Object.keys(elements)) elements[key]?.remove();
    elements = {};
    doc.querySelectorAll(".vx-onebar").forEach((e) => e.remove());
    for (const card of doc.querySelectorAll("[data-vx-hidden]")) {
      card.hidden = false;
      card.removeAttribute("data-vx-hidden");
    }
    for (const name of Object.values(CLASS)) root.classList.remove(name);
  }

  return { start, stop, refresh: chrome };
}
