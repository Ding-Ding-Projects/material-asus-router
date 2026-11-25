// A very small stand-in for the browser's DOM, enough to draw a feature screen in
// Node and click around in it. It supports what the screens use: elements and
// text, attributes, classes, simple selectors (tag, .class, [attr], :not(.class)),
// events that bubble, and a few layout stubs. It is not a browser: it proves a
// screen draws without throwing and that its controls do what they say, not how
// anything looks.
class Node {
  constructor() {
    this.parentNode = null;
    this.childNodes = [];
  }

  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n === globalThis.document?.body || n.isRoot === true;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }
}

class Text extends Node {
  constructor(text) {
    super();
    this.data = String(text);
  }

  get textContent() {
    return this.data;
  }
}

const parseSelector = (sel) => {
  const m = sel.match(/^([a-zA-Z0-9-]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)((?::not\(\.[\w-]+\))*)$/);
  if (!m) throw new Error(`dom-lite: unsupported selector ${sel}`);
  return {
    tag: m[1].toLowerCase(),
    classes: [...m[2].matchAll(/\.([\w-]+)/g)].map((x) => x[1]),
    attrs: [...m[3].matchAll(/\[([\w-]+)(?:="?([^\]"]*)"?)?\]/g)].map((x) => [x[1], x[2]]),
    not: [...m[4].matchAll(/:not\(\.([\w-]+)\)/g)].map((x) => x[1]),
  };
};

class Element extends Node {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.listeners = new Map();
    this.classSet = new Set();
    this.styleMap = new Map();
    const self = this;
    this.style = { setProperty: (k, v) => self.styleMap.set(k, v), removeProperty: (k) => self.styleMap.delete(k) };
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.tabIndex = -1;
    this.classList = {
      add: (...c) => c.forEach((x) => self.classSet.add(x)),
      remove: (...c) => c.forEach((x) => self.classSet.delete(x)),
      toggle: (c, force) => (force === undefined ? (self.classSet.has(c) ? self.classSet.delete(c) : self.classSet.add(c)) : force ? self.classSet.add(c) : self.classSet.delete(c)),
      contains: (c) => self.classSet.has(c),
    };
  }

  get className() {
    return [...this.classSet].join(" ");
  }

  set className(v) {
    this.classSet = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get children() {
    return this.childNodes.filter((n) => n instanceof Element);
  }

  get dataset() {
    const out = {};
    for (const [k, v] of this.attributes) if (k.startsWith("data-")) out[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    return out;
  }

  get textContent() {
    return this.childNodes.map((n) => n.textContent).join("");
  }

  set textContent(v) {
    this.replaceChildren(String(v));
  }

  get innerText() {
    return this.textContent;
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === "class") this.className = v;
    if (k === "value") this.value = String(v);
  }

  getAttribute(k) {
    return k === "class" ? this.className || null : (this.attributes.get(k) ?? null);
  }

  removeAttribute(k) {
    this.attributes.delete(k);
  }

  hasAttribute(k) {
    return this.attributes.has(k);
  }

  append(...kids) {
    for (const kid of kids) {
      const node = kid instanceof Node ? kid : new Text(kid);
      node.parentNode?.childNodes.splice(node.parentNode.childNodes.indexOf(node), 1);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  prepend(...kids) {
    const old = [...this.childNodes];
    this.replaceChildren(...kids, ...old);
  }

  replaceChildren(...kids) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    this.append(...kids);
  }

  replaceWith(node) {
    const p = this.parentNode;
    if (!p) return;
    const at = p.childNodes.indexOf(this);
    p.childNodes[at] = node;
    node.parentNode = p;
    this.parentNode = null;
  }

  remove() {
    const p = this.parentNode;
    if (p) p.childNodes.splice(p.childNodes.indexOf(this), 1);
    this.parentNode = null;
  }

  contains(n) {
    for (let x = n; x; x = x.parentNode) if (x === this) return true;
    return false;
  }

  cloneNode(deep) {
    const copy = new Element(this.tagName.toLowerCase());
    for (const [k, v] of this.attributes) copy.setAttribute(k, v);
    copy.classSet = new Set(this.classSet);
    if (deep) for (const c of this.childNodes) copy.append(c instanceof Element ? c.cloneNode(true) : new Text(c.data));
    return copy;
  }

  matches(sel) {
    const p = parseSelector(sel);
    if (p.tag && p.tag !== this.tagName.toLowerCase()) return false;
    if (!p.classes.every((c) => this.classSet.has(c))) return false;
    if (p.not.some((c) => this.classSet.has(c))) return false;
    return p.attrs.every(([k, v]) => this.attributes.has(k) && (v === undefined || this.attributes.get(k) === v));
  }

  closest(sel) {
    for (let n = this; n instanceof Element; n = n.parentNode) if (n.matches(sel)) return n;
    return null;
  }

  // Supports lists (a, b) and descendant chains (.a .b).
  matchesChain(chain) {
    const parts = chain.trim().split(/\s+/);
    if (!this.matches(parts.at(-1))) return false;
    let at = this.parentNode;
    for (let i = parts.length - 2; i >= 0; i -= 1) {
      while (at instanceof Element && !at.matches(parts[i])) at = at.parentNode;
      if (!(at instanceof Element)) return false;
      at = at.parentNode;
    }
    return true;
  }

  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      for (const c of node.childNodes) {
        if (c instanceof Element) {
          if (sel.split(",").some((s) => c.matchesChain(s))) out.push(c);
          walk(c);
        }
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }

  dispatchEvent(event) {
    event.target ??= this;
    for (let n = this; n && !event.stopped; n = n.parentNode) {
      event.currentTarget = n;
      for (const fn of [...(n.listeners?.get(event.type) ?? [])]) {
        fn(event);
        if (event.stoppedImmediate) break;
      }
      if (!event.bubbles) break;
    }
    return !event.defaultPrevented;
  }

  fire(type, extra = {}) {
    return this.dispatchEvent({ type, bubbles: true, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; this.stoppedImmediate = true; }, button: 0, clientX: 0, clientY: 0, ...extra });
  }

  click() {
    if (!this.disabled) this.fire("click");
  }

  focus() {
    globalThis.document.activeElement = this;
  }

  select() {}

  setPointerCapture() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40, toJSON() { return { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 }; } };
  }
}

export function installDom() {
  const body = new Element("body");
  const documentListeners = new Map();
  globalThis.Node = Node;
  globalThis.Element = Element;
  globalThis.document = {
    body,
    hidden: false,
    createElement: (tag) => new Element(tag),
    createElementNS: (_ns, tag) => new Element(tag),
    createTextNode: (t) => new Text(t),
    addEventListener: (type, fn) => documentListeners.set(type, [...(documentListeners.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => documentListeners.set(type, (documentListeners.get(type) ?? []).filter((f) => f !== fn)),
    elementFromPoint: () => null,
    activeElement: null,
  };
  return { body, Element };
}

export const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
