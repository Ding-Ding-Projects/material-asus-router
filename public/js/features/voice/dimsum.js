// The dim sum surprise. Once in about ten launches, a small card appears with one
// dish, its English and Traditional Chinese names and its picture. It is never
// shown during the first launch, while an error is on screen, during an update or
// while a task is running, it never takes focus, it dismisses itself, and it is
// left out entirely in School mode. The picture comes from the public dim sum
// catalogue through this app's own server (the page may only load pictures from
// itself); nothing is fetched from, or sent to, a third party by the page.
//
// It cannot be opted out of. The Settings switch for it is a joke: it flips off,
// then springs back on.

export const RATE = 0.1;
export const SESSION_KEY = "mar.voice.dimsum.drawn";
export const RETRY_MS = 5000;
export const RETRIES = 8;
export const SHOW_MS = 9000;

export const drawHit = (random = Math.random, rate = RATE) => random() < rate;

// Why a surprise must wait right now, or null when it may appear.
export function blockedBy({ doc, route, dockCount = 0 }) {
  if (doc.querySelector(".toast.bad, .card.bad, .note.bad")) return "error";
  if (doc.querySelector("dialog[open]")) return "dialog";
  if (doc.querySelector(".spin")) return "task";
  if (/firmware|maintenance|backup/.test(route ?? "") && dockCount > 0) return "update";
  return null;
}

export function createDimsum({ doc = globalThis.document, ctx, getRecord, tr, store, sounds, session, random = Math.random, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), isSchool = () => false, lowStimulation = () => false }) {
  const { h, icon } = ctx;
  let card = null;
  let timers = [];
  const after = (fn, ms) => {
    const id = setTimer(fn, ms);
    timers.push(id);
    return id;
  };

  const mode = () => ctx.getLang();
  const names = (dish) => {
    const m = mode();
    return m === "en" ? dish.en : m === "yue" ? dish.zhHant : `${dish.en} · ${dish.zhHant}`;
  };
  const alt = (dish) => {
    const m = mode();
    return m === "en" ? dish.altEn : m === "yue" ? dish.altYue : `${dish.altEn} · ${dish.altYue}`;
  };

  function dismiss() {
    card?.remove();
    card = null;
  }

  function show(found) {
    dismiss();
    const calm = lowStimulation() || getRecord().look.motion === "reduced" || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let hover = false;
    const close = h("button", { class: "btn t icon", "aria-label": tr("dimsumClose"), onClick: dismiss }, icon("close", "sm"));
    card = h("figure", { class: `vx-dimsum ${calm ? "calm" : ""}`, role: "status", "aria-live": "polite", onMouseenter: () => (hover = true), onMouseleave: () => (hover = false), onKeydown: (e) => e.key === "Escape" && dismiss() },
      h("img", { src: found.photo.dataUrl, alt: alt(found.dish), width: "160", height: "160" }),
      h("figcaption", {}, h("div", { class: "k" }, tr("dimsumToday")), h("div", { class: "t1" }, names(found.dish))),
      close);
    doc.body.append(card);
    sounds?.play("pop");
    const shownCard = card;
    const wait = () => after(() => (hover ? wait() : card === shownCard && dismiss()), SHOW_MS);
    wait();
    store.append("dimsum-shown", { dish: found.dish.id });
  }

  async function reveal() {
    try {
      const found = await ctx.api.get("/api/x/voice/dimsum/dish");
      if (!found?.dish || !found?.photo?.dataUrl) {
        store.append("dimsum-omitted", { why: "no-picture" });
        ctx.notice?.("warn", tr.en("dimsumSkippedNoPicture"));
        return { shown: false, why: "no-picture" };
      }
      show(found);
      return { shown: true, dish: found.dish.id };
    } catch (error) {
      store.append("dimsum-omitted", { why: error.code ?? "unreachable" });
      ctx.notice?.("warn", tr.en("dimsumSkippedUnavailable"));
      return { shown: false, why: error.code ?? "unreachable" };
    }
  }

  // Called once when the app opens. The draw happens at most once per browser
  // session, so reloading the page never gives a second chance.
  function maybeDraw() {
    if (isSchool()) return { drawn: false, why: "school" };
    if (session?.getItem(SESSION_KEY)) return { drawn: false, why: "already-drawn" };
    try {
      session?.setItem(SESSION_KEY, "1");
    } catch {}
    const launches = getRecord().dimsum.launches;
    store.update((r) => void (r.dimsum.launches = launches + 1), "launch");
    if (launches === 0) return { drawn: false, why: "first-launch" };
    if (!drawHit(random)) return { drawn: true, hit: false };
    let tries = 0;
    const attempt = () => {
      if (isSchool()) return;
      const why = blockedBy({ doc, route: ctx.state.route, dockCount: ctx.dock.count() });
      if (why && ++tries <= RETRIES) return void after(attempt, RETRY_MS);
      if (why) return void store.append("dimsum-omitted", { why });
      reveal();
    };
    after(attempt, 4000);
    return { drawn: true, hit: true };
  }

  const stop = () => {
    timers.forEach(clearTimer);
    timers = [];
    dismiss();
  };
  return { maybeDraw, reveal, show, dismiss, stop, get visible() { return Boolean(card); } };
}
