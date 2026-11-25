// A very small DOM stand-in, just enough for the app's element builder and dialogs, so browser feature code can be
// drawn and its buttons tapped from Node tests. It supports class, attribute, listener, child and simple selector
// (".a.b", "[attr=\"v\"]", tag) handling. It is not a layout or visual check.
class Node {}
class Text extends Node {
  constructor(data) {
    super();
    this.data = data;
    this.parent = null;
  }
  get textContent() {
    return this.data;
  }
}
class Element extends Node {
  constructor(tag) {
    super();
    Object.assign(this, { tag, children: [], parent: null, className: "", attrs: new Map(), listeners: new Map(), hidden: false, disabled: false, value: "", checked: false, selected: false, open: false });
    this.style = { props: {}, setProperty: (k, v) => (this.style.props[k] = v) };
  }
  get classList() {
    const self = this;
    const names = () => self.className.split(/\s+/).filter(Boolean);
    return { contains: (c) => names().includes(c), add: (c) => (self.className = [...new Set([...names(), c])].join(" ")), remove: (c) => (self.className = names().filter((n) => n !== c).join(" ")), toggle(c, on) { (on ?? !names().includes(c)) ? this.add(c) : this.remove(c); } };
  }
  append(...kids) {
    for (const raw of kids) {
      const kid = typeof raw === "string" ? new Text(raw) : raw;
      kid.parent?.children.splice(kid.parent.children.indexOf(kid), 1);
      kid.parent = this;
      this.children.push(kid);
    }
  }
  prepend(kid) {
    kid.parent = this;
    this.children.unshift(kid);
  }
  replaceChildren(...kids) {
    this.children = [];
    this.append(...kids);
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(name, fn) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  fire(name, extra = {}) {
    for (const fn of this.listeners.get(name) ?? []) fn({ target: this, currentTarget: this, preventDefault() {}, ...extra });
  }
  click() {
    if (!this.disabled) this.fire("click");
  }
  get textContent() {
    return this.children.map((c) => c.textContent).join("");
  }
  set textContent(text) {
    const node = new Text(String(text));
    node.parent = this;
    this.children = [node];
  }
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
  replaceWith(next) {
    const at = this.parent.children.indexOf(this);
    next.parent = this.parent;
    this.parent.children[at] = next;
  }
  focus() {}
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  matches(sel) {
    if (sel.startsWith(".")) return sel.slice(1).split(".").every((c) => this.className.split(/\s+/).includes(c));
    const attr = sel.match(/^\[([\w-]+)="(.*)"\]$/);
    if (attr) return this.attrs.get(attr[1]) === attr[2];
    return this.tag === sel;
  }
  all(sel, out = []) {
    for (const child of this.children) {
      if (child instanceof Element) {
        if (child.matches(sel)) out.push(child);
        child.all(sel, out);
      }
    }
    return out;
  }
  querySelectorAll(sel) {
    return this.all(sel);
  }
  querySelector(sel) {
    return this.all(sel)[0] ?? null;
  }
}
const document = { body: new Element("body"), documentElement: new Element("html"), createElement: (t) => new Element(t), createElementNS: (ns, t) => new Element(t), createTextNode: (s) => new Text(s), querySelector: () => null };
export { Element, Node, Text, document };

// Makes the stand-in the page's globals for the rest of this process.
export const install = () => Object.assign(globalThis, { Node, document });
