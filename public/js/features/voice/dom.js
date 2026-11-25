// The page layer. The app draws its screens with its own code, so wording that
// belongs to the whole app (the product name, a person's own words, the funny
// level asides, the dialog emoji) is applied here, to what is on the page, by
// watching for changes. Every original text is remembered, so turning a thing
// off puts the shipped wording back exactly.
//
// Commands, identifiers and anything inside code, preformatted or monospace
// elements stay literal, so a router command or a setting key is never reworded.
import { RULES, asideFor, emojiFor } from "./tone.js";

const SKIP = "code, pre, kbd, samp, script, style, textarea, input, select, option, [data-literal], .mono, .fp, .vx-literal, .vx-tone, .vx-emoji, .ms";
const ATTRS = ["aria-label", "title", "placeholder", "alt"];
const HOSTS = ".toast, .card.bad, .note.bad, .note.warn, .card.warn, .empty, dialog .sheet";

export const visibleText = (el) => {
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === 3) out += node.data;
    else if (node.nodeType === 1 && !node.matches?.("[aria-hidden='true'], .vx-tone, .vx-emoji, .ms, script, style")) out += `${visibleText(node)}`;
  }
  return out.replace(/[ \t]+/g, " ").trim();
};

export function createDomLayer({ doc = globalThis.document, getConfig, hooks = {} }) {
  if (!doc) return null;
  const texts = new WeakMap();
  const attrs = new WeakMap();
  let observer = null;
  let titleSource = null;
  let titleOut = null;
  let live = null;

  const cfg = () => getConfig();
  const transform = (value) => {
    const c = cfg();
    const renamed = c.displayName && c.displayName !== c.shipped;
    // The product's name is never reworded by personal wording: split around it,
    // swap the name if it was renamed, and reword only the text in between.
    if (!c.replace || !value.includes(c.shipped)) {
      const out = renamed && value.includes(c.shipped) ? value.split(c.shipped).join(c.displayName) : value;
      return c.replace ? c.replace(out) : out;
    }
    return value.split(c.shipped).map((piece) => c.replace(piece)).join(renamed ? c.displayName : c.shipped);
  };
  const skipped = (node) => Boolean((node.nodeType === 1 ? node : node.parentElement)?.closest?.(SKIP));

  function processText(node) {
    if (skipped(node)) return;
    const rec = texts.get(node);
    const src = rec && node.data === rec.out ? rec.src : node.data;
    const out = transform(src);
    if (out === src) {
      texts.delete(node);
      if (node.data !== src) node.data = src;
      return;
    }
    texts.set(node, { src, out });
    if (node.data !== out) node.data = out;
  }

  function processAttr(el, name) {
    const current = el.getAttribute(name);
    if (current === null || skipped(el)) return;
    let map = attrs.get(el);
    const rec = map?.get(name);
    const src = rec && current === rec.out ? rec.src : current;
    const out = transform(src);
    if (out === src) {
      map?.delete(name);
      if (current !== src) el.setAttribute(name, src);
      return;
    }
    if (!map) attrs.set(el, (map = new Map()));
    map.set(name, { src, out });
    if (current !== out) el.setAttribute(name, out);
  }

  function walk(root) {
    if (root.nodeType === 3) return processText(root);
    if (root.nodeType !== 1) return;
    const walker = doc.createTreeWalker(root, 4 | 1);
    let node = walker.currentNode;
    for (;;) {
      if (node.nodeType === 3) processText(node);
      else if (node.nodeType === 1) for (const a of ATTRS) if (node.hasAttribute(a)) processAttr(node, a);
      node = walker.nextNode();
      if (!node) break;
    }
  }

  function title() {
    const c = cfg();
    if (titleOut === null || doc.title !== titleOut) titleSource = doc.title;
    const out = c.displayName && c.displayName !== c.shipped ? titleSource.split(c.shipped).join(c.displayName) : titleSource;
    titleOut = out;
    if (doc.title !== out) doc.title = out;
  }

  // ---- funny-level asides and dialog emoji ----
  const categoryOf = (el) => RULES.find((r) => r.match(el))?.category ?? null;

  function tone(host) {
    const c = cfg();
    const existing = [...host.children].filter((k) => k.classList?.contains("vx-tone"));
    const category = categoryOf(host);
    const text = category && !c.school ? asideFor(category, c.tone, c.mode) : "";
    if (!text) return void existing.forEach((k) => k.remove());
    if (existing.length === 1 && existing[0].textContent === text) return;
    existing.forEach((k) => k.remove());
    const span = doc.createElement("span");
    span.className = "vx-tone";
    span.textContent = text;
    const before = host.matches("dialog .sheet") ? host.querySelector(":scope > .actions") : null;
    host.insertBefore(span, before);
  }

  function emoji(sheet) {
    const c = cfg();
    const heading = sheet.querySelector("h2");
    sheet.querySelectorAll(".vx-emoji").forEach((e) => e.remove());
    if (!c.emoji || c.school || !heading) return;
    const span = doc.createElement("span");
    span.className = "vx-emoji";
    span.setAttribute("aria-hidden", "true");
    span.textContent = `${emojiFor(heading.textContent)} `;
    heading.prepend(span);
  }

  function decorate(root) {
    if (root.nodeType !== 1) return;
    const hosts = new Set(root.matches?.(HOSTS) ? [root] : []);
    root.querySelectorAll?.(HOSTS).forEach((h) => hosts.add(h));
    const own = root.closest?.(HOSTS);
    if (own) hosts.add(own);
    for (const host of hosts) {
      tone(host);
      if (host.matches("dialog .sheet")) emoji(host);
    }
  }

  function omitSchool() {
    if (!cfg().school) return;
    for (const group of doc.querySelectorAll(".bar [role='radiogroup']")) {
      const labels = [...group.querySelectorAll("button")].map((b) => b.textContent.trim());
      if (labels.includes("EN") && labels.some((l) => l.includes("粵"))) group.remove();
    }
  }

  function announceAdded(root) {
    if (root.nodeType !== 1 || !hooks.added) return;
    const found = new Set();
    if (root.matches?.(".toast, dialog, .page")) found.add(root);
    root.querySelectorAll?.(".toast, dialog[open], .page").forEach((e) => found.add(e));
    for (const el of found) hooks.added(el);
  }

  function handle(records) {
    for (const rec of records) {
      if (rec.type === "characterData") processText(rec.target);
      else if (rec.type === "attributes") processAttr(rec.target, rec.attributeName);
      else if (rec.type === "childList") {
        for (const node of rec.addedNodes) {
          walk(node);
          if (node.nodeType === 1) {
            decorate(node);
            announceAdded(node);
          }
        }
        if (rec.target.nodeType === 1) {
          const host = rec.target.closest?.(HOSTS);
          if (host && ![...rec.addedNodes].every((n) => n.classList?.contains("vx-tone"))) decorate(host);
        }
      }
    }
    omitSchool();
    observer?.takeRecords();
  }

  function refresh() {
    walk(doc.body);
    for (const host of doc.querySelectorAll(HOSTS)) {
      tone(host);
      if (host.matches("dialog .sheet")) emoji(host);
    }
    title();
    omitSchool();
    observer?.takeRecords();
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver((records) => handle(records));
    observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const head = doc.querySelector("title");
    if (head) new MutationObserver(() => title()).observe(head, { childList: true, characterData: true, subtree: true });
    refresh();
  }

  function stop() {
    observer?.disconnect();
    observer = null;
  }

  // A polite live region for announcements that have no visible message of their own.
  function announce(message) {
    if (!live) {
      live = doc.createElement("div");
      live.id = "vx-live";
      live.className = "sr";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      doc.body.append(live);
    }
    const c = cfg();
    const extra = c.school ? "" : asideFor("access", c.tone, c.mode);
    live.textContent = "";
    // A new text node each time, so the same words are announced again.
    setTimeout(() => (live.textContent = extra ? `${message} ${extra}` : message), 30);
  }

  return { start, stop, refresh, announce, tone, walk, transform };
}
