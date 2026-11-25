// Tests for the floating panels: they stay inside the window at every size,
// move and resize from any edge, remember their place, and reset.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/overlay-panels/index.js";
import { MIN_H, MIN_W, anchoredRect, clampRect, defaultRect, moveRect, resetAllPanels, resetPanel, resizeRect, savedRect } from "../../public/js/features/overlay-panels/panels.js";
import { createPrefs } from "../../public/js/features/material-design/prefs.js";
import { MemoryStorage, readSources } from "./fakes.mjs";

const inside = (r, vp) => r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.w && r.y + r.h <= vp.h;
const VIEWPORTS = [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }, { w: 768, h: 1024 }, { w: 360, h: 640 }, { w: 320, h: 480 }, { w: 200, h: 150 }];

test("overlay-panels: the module is well formed and has a toolbar button and commands", () => {
  assert.equal(checkFeatureModule(feature, "overlay-panels"), null);
  assert.ok(feature.toolbar.length === 1 && feature.commands.length === 2);
});

test("overlay-panels: a panel is always inside the window and never smaller than its minimum (when the window allows)", () => {
  for (const vp of VIEWPORTS) {
    for (const r of [{ x: -500, y: -500, w: 10, h: 10 }, { x: 9999, y: 9999, w: 9999, h: 9999 }, { x: 100, y: 100, w: 420, h: 360 }, { x: 0, y: 0, w: 0, h: 0 }]) {
      const c = clampRect(r, vp);
      assert.ok(inside(c, vp), `${JSON.stringify(r)} in ${vp.w}x${vp.h} became ${JSON.stringify(c)}`);
      if (vp.w >= MIN_W + 16 && vp.h >= MIN_H + 16) assert.ok(c.w >= MIN_W && c.h >= MIN_H, "keeps its minimum size");
    }
    assert.ok(inside(defaultRect(vp), vp), `the default place fits ${vp.w}x${vp.h}`);
  }
});

test("overlay-panels: moving keeps the panel inside, and every edge and corner resizes the right way", () => {
  const vp = { w: 1000, h: 800 };
  const r = { x: 300, y: 200, w: 400, h: 300 };
  assert.deepEqual(moveRect(r, 50, -20, vp), { x: 350, y: 180, w: 400, h: 300 });
  assert.equal(moveRect(r, -9999, -9999, vp).x, 8);
  assert.ok(inside(moveRect(r, 9999, 9999, vp), vp));
  assert.deepEqual(resizeRect(r, "e", 40, 0, vp), { x: 300, y: 200, w: 440, h: 300 });
  assert.deepEqual(resizeRect(r, "s", 0, 30, vp), { x: 300, y: 200, w: 400, h: 330 });
  assert.deepEqual(resizeRect(r, "w", -60, 0, vp), { x: 240, y: 200, w: 460, h: 300 });
  assert.deepEqual(resizeRect(r, "n", 0, -50, vp), { x: 300, y: 150, w: 400, h: 350 });
  assert.deepEqual(resizeRect(r, "se", 10, 10, vp), { x: 300, y: 200, w: 410, h: 310 });
  assert.deepEqual(resizeRect(r, "nw", -10, -10, vp), { x: 290, y: 190, w: 410, h: 310 });
  assert.deepEqual(resizeRect(r, "ne", 10, -10, vp), { x: 300, y: 190, w: 410, h: 310 });
  assert.deepEqual(resizeRect(r, "sw", -10, 10, vp), { x: 290, y: 200, w: 410, h: 310 });
  const small = resizeRect(r, "e", -9999, 0, vp);
  assert.equal(small.w, MIN_W, "cannot shrink past the minimum");
  const left = resizeRect(r, "w", 9999, 0, vp);
  assert.equal(left.w, MIN_W);
  assert.equal(left.x + left.w, 700, "the far edge stays put when the near edge is dragged in");
  assert.ok(inside(resizeRect(r, "se", 9999, 9999, vp), vp));
});

test("overlay-panels: a panel opens next to the element being edited", () => {
  const vp = { w: 1200, h: 800 };
  const right = anchoredRect({ left: 100, right: 300, top: 200, bottom: 260 }, { w: 400, h: 400 }, vp);
  assert.equal(right.x, 312);
  assert.equal(right.y, 200);
  const left = anchoredRect({ left: 900, right: 1190, top: 200, bottom: 260 }, { w: 400, h: 400 }, vp);
  assert.equal(left.x, 900 - 400 - 12);
  const below = anchoredRect({ left: 20, right: 1190, top: 100, bottom: 160 }, { w: 400, h: 300 }, { w: 1200, h: 800 });
  assert.ok(inside(below, { w: 1200, h: 800 }));
});

test("overlay-panels: size and position are remembered per panel across a restart, and reset", () => {
  const storage = new MemoryStorage();
  const store = createPrefs(storage);
  store.update((d) => { d.panels.a = { x: 40, y: 50, w: 300, h: 260 }; d.panels.b = { x: 80, y: 90, w: 500, h: 400 }; });
  const again = createPrefs(storage);
  assert.deepEqual(savedRect("a", again), { x: 40, y: 50, w: 300, h: 260 });
  assert.deepEqual(savedRect("b", again), { x: 80, y: 90, w: 500, h: 400 });
  resetPanel("a", again);
  assert.equal(savedRect("a", again), null);
  assert.ok(savedRect("b", again), "only that panel was reset");
  resetAllPanels(again);
  assert.equal(savedRect("b", createPrefs(storage)), null);
  store.update((d) => { d.panels.bad = { x: "x", y: 1, w: 5, h: 5 }; });
  assert.equal(savedRect("bad", store), null, "a damaged saved place is ignored");
});

test("overlay-panels: the panel code supports the keyboard, closes with Escape and returns focus", async () => {
  const src = (await readSources("overlay-panels"))["panels.js"];
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "Escape"]) assert.ok(src.includes(key), `${key} is handled`);
  assert.ok(src.includes("shiftKey"), "Shift resizes");
  assert.ok(src.includes("opener?.isConnected") && src.includes("opener.focus"), "focus goes back to the opener");
  assert.ok(src.includes('"aria-modal": "false"'), "the panel does not trap the page");
  assert.equal([...src.matchAll(/"n", "ne", "e", "se", "s", "sw", "w", "nw"/g)].length, 1, "eight resize handles");
});
