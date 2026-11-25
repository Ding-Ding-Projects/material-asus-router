// Rich controls: every catalogue control type is drawn by a real control, plain
// text appears only with a stated reason, the inventory of surfaces is
// honest, and the long-list helper only keeps the visible rows alive.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import "../../public/js/controls-rich.js";
import { controlTypes } from "../../public/js/control-registry.js";
import feature, { SURFACES, hostnameOk, virtualList } from "../../public/js/features/rich-controls/index.js";
import { allEntries, assertModuleListed } from "../nav-kit.mjs";

// The types controls.js draws itself; every other type must be registered.
const STOCK_DRAWN = new Set(["switch", "select", "slider", "number", "ipv4", "password"]);

// The control types every feature module registers when the app loads.
const featureTypes = new Set();
for (const entry of await readdir(new URL("../../public/js/features/", import.meta.url), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const m = (await import(new URL(`../../public/js/features/${entry.name}/index.js`, import.meta.url).href)).default;
  for (const type of Object.keys(m.controls ?? {})) featureTypes.add(type);
}

test("rich-controls: the host name setting has a real control that validates as you type", () => {
  assert.ok(featureTypes.has("hostname"));
  assert.equal(hostnameOk("pool.example.test", false), true);
  assert.equal(hostnameOk("", true), true);
  assert.equal(hostnameOk("", false), false);
  assert.equal(hostnameOk("not a host!", true), false);
  assert.equal(hostnameOk("-bad.test", true), false);
});

test("rich-controls: every setting on both routers is drawn by a real typed control, and plain text always has a reason", async () => {
  for (const e of await allEntries()) {
    if (e.control === "text") {
      assert.equal(e.freeText, true, `${e.id}: plain text needs freeText`);
      assert.ok(e.freeTextReason, `${e.id}: plain text needs a named reason`);
      assert.ok(e.maxLength, `${e.id}: plain text needs a limit`);
    } else assert.ok(STOCK_DRAWN.has(e.control) || controlTypes.has(e.control) || featureTypes.has(e.control), `${e.id}: no control draws ${e.control}`);
  }
});

test("rich-controls: the inventory names every surface and gives each readout its reason", () => {
  assert.ok(SURFACES.length >= 7);
  const ids = new Set();
  for (const s of SURFACES) {
    assert.ok(!ids.has(s.id));
    ids.add(s.id);
    if (s.rich) assert.ok(s.how, s.id);
    else assert.ok(s.reason && s.reason.length > 30, `${s.id} names why it stays a readout`);
  }
  for (const must of ["settings-rows", "palette", "context-menu", "top-search"]) assert.ok(SURFACES.find((s) => s.id === must)?.rich, must);
});

// A tiny stand-in for the page, enough to prove only the visible rows exist.
function fakeDom() {
  const el = () => ({ children: [], style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, replaceChildren(...k) { this.children = k; }, addEventListener() {}, removeEventListener() {} });
  globalThis.document = { createElement: el };
}

test("rich-controls: a long list renders only the rows in view and sizes the scroll area for all of them", () => {
  fakeDom();
  try {
    const container = { scrollTop: 0, clientHeight: 480, children: [], replaceChildren(...k) { this.children = k; }, addEventListener(name, fn) { this.onscroll = fn; }, removeEventListener() {} };
    const items = Array.from({ length: 20000 }, (_, i) => i);
    const made = [];
    const list = virtualList(container, items, { rowHeight: 48, overscan: 4, render: (item, index) => { made.push(index); return document.createElement("div"); } });
    const [spacer, view] = container.children;
    assert.equal(spacer.style.props.height, `${20000 * 48}px`);
    assert.ok(view.children.length <= 10 + 4 + 1, `only ${view.children.length} rows exist`);
    container.scrollTop = 48 * 5000;
    made.length = 0;
    container.onscroll();
    assert.ok(Math.min(...made) >= 5000 - 4 && Math.max(...made) <= 5000 + 10 + 4, "scrolling renders the window around the new position");
    list.destroy();
  } finally {
    delete globalThis.document;
  }
});

test("rich-controls: the module is listed, styled and well formed", async () => {
  await assertModuleListed("rich-controls", feature, { style: true });
  assert.equal(typeof globalThis.marNav.virtualList, "function");
});
