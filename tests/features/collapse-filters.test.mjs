// Tests for collapsible sections: defaults, persistence across a restart, and
// the section element's own behaviour (state announced, active filter said
// out loud while collapsed), run against a tiny stand-in for the page.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/collapse-filters/index.js";
import { collapsible, isCollapsed, resetCollapsed, setCollapsed } from "../../public/js/features/collapse-filters/collapsible.js";
import { createPrefs } from "../../public/js/features/material-design/prefs.js";
import { prefs } from "../../public/js/features/material-design/prefs.js";
import { MemoryStorage } from "./fakes.mjs";

// A very small DOM: enough for h(), icon() and the attributes the section sets.
class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.hidden = false; this.listeners = {}; this.classes = new Set(); this.isConnected = true; this.textContent = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(n, f) { this.listeners[n] = f; }
  get classList() { return { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)) }; }
  append(...k) { this.children.push(...k); }
}
const ctx = {
  h(tag, props = {}, ...kids) {
    const el = new El(tag);
    for (const [k, v] of Object.entries(props)) { if (k === "onClick") el.listeners.click = v; else if (k === "hidden") el.hidden = v; else el.attrs[k] = v; }
    el.append(...kids.flat(Infinity));
    return el;
  },
  icon: (n) => new El(`icon:${n}`),
  t: (en) => en,
  tt: (p) => p.en,
};

test("collapse-filters: the module is well formed with a settings card and a reset command", () => {
  assert.equal(checkFeatureModule(feature, "collapse-filters"), null);
  assert.equal(feature.settings.length, 1);
  assert.equal(feature.commands.length, 1);
});

test("collapse-filters: descriptive sections start collapsed and the choice is remembered across a restart", () => {
  const storage = new MemoryStorage();
  const a = createPrefs(storage);
  assert.equal(isCollapsed("stats", true, a), true, "descriptive: collapsed by default");
  assert.equal(isCollapsed("filters", false, a), false, "a filter bar starts open");
  setCollapsed("stats", false, a);
  setCollapsed("filters", true, a);
  const b = createPrefs(storage);
  assert.equal(isCollapsed("stats", true, b), false);
  assert.equal(isCollapsed("filters", false, b), true);
  resetCollapsed(b);
  assert.equal(isCollapsed("stats", true, createPrefs(storage)), true, "reset goes back to each section's default");
});

test("collapse-filters: the section announces its state and says when a collapsed section hides an active filter", () => {
  prefs.reset();
  let active = 0;
  const section = collapsible(ctx, { id: "t.filters", title: { en: "Filters" }, activeCount: () => active }, ctx.h("div", {}, "body"));
  const [button, body] = section.children;
  const badge = button.children.find((c) => c.attrs?.role === "status");
  assert.equal(button.attrs["aria-expanded"], "true", "a filter section starts open");
  assert.equal(body.hidden, false);
  assert.equal(button.attrs["aria-controls"], "cf-t.filters");
  active = 2;
  button.listeners.click(); // collapse
  assert.equal(button.attrs["aria-expanded"], "false");
  assert.equal(body.hidden, true);
  assert.equal(badge.hidden, false, "the hidden filters are mentioned");
  assert.match(badge.textContent, /2 active, hidden/);
  active = 0;
  section.refresh();
  assert.equal(badge.hidden, true, "nothing active, nothing to say");
  active = 1;
  button.listeners.click(); // expand again
  assert.equal(button.attrs["aria-expanded"], "true");
  assert.equal(badge.hidden, true, "open sections show their filters, so no warning is needed");
  assert.equal(prefs.get().collapsed["t.filters"], false);
  const descriptive = collapsible(ctx, { id: "t.stats", title: { en: "Stats" }, descriptive: true }, ctx.h("div", {}));
  assert.equal(descriptive.children[0].attrs["aria-expanded"], "false", "a descriptive section starts collapsed");
  prefs.reset();
});
