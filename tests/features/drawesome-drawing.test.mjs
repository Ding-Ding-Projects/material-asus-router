// The drawing model is pure, so every pen, the eraser, the straight-line lock,
// undo and the exports are tested from Node. The canvas itself needs a browser.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DrawHistory, EXPORT_SCALES, PENS, SHORTCUTS, eraseAt, lockPoints, outline, packStrokes, pen, strokePath, toSvg, unpackStrokes, widths } from "../../public/js/features/drawesome-drawing/strokes.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/drawesome-drawing/index.js";
import { startApp } from "../helpers.mjs";

const line = (penId, n = 40, speed = 1, size = 10) => ({ id: `s-${penId}`, pen: penId, color: "#336699", size, points: Array.from({ length: n }, (_, i) => ({ x: 20 + i * 10, y: 100 + Math.sin(i / 5) * 20, t: (i * 10) / speed })) });

test("there are seven pens and each one gives its line a different shape", () => {
  assert.equal(PENS.length, 7);
  assert.deepEqual(PENS.map((p) => p.key), ["1", "2", "3", "4", "5", "6", "7"]);
  const paths = new Map(PENS.map((p) => [p.id, strokePath(line(p.id))]));
  assert.equal(new Set(paths.values()).size, 7, "no two pens draw the same outline");
  for (const [id, d] of paths) assert.match(d, /^M[-\d. L]+Z$/, id);
});

test("each pen's width behaviour is the one it promises", () => {
  const ws = (id, o) => widths(line(id, 40, o?.speed ?? 1, 10));
  const spread = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(spread(ws("ballpoint")) === 0, "ballpoint is even");
  assert.ok(ws("marker")[5] === 20 && ws("highlighter")[5] === 40, "marker and highlighter are wide and even");
  const slowFountain = ws("fountain", { speed: 0.05 })[20];
  const fastFountain = ws("fountain", { speed: 20 })[20];
  assert.ok(slowFountain > fastFountain * 1.5, "the fountain pen is thinner when moved fast");
  const brush = ws("brush");
  assert.ok(brush[0] < brush[20] / 2 && brush.at(-1) < brush[20] / 2, "the brush tapers at both ends");
  assert.ok(spread(ws("pencil")) > 0 && Math.max(...ws("pencil")) < 10, "the pencil is thin and uneven");
  assert.deepEqual(ws("pencil"), ws("pencil"), "the unevenness is steady, so an export matches the screen");
  const nib = widths({ pen: "calligraphy", size: 10, points: [{ x: 0, y: 0, t: 0 }, { x: 40, y: 40, t: 40 }, { x: 80, y: 80, t: 80 }] });
  const across = widths({ pen: "calligraphy", size: 10, points: [{ x: 0, y: 0, t: 0 }, { x: 40, y: -40, t: 40 }, { x: 80, y: -80, t: 80 }] });
  assert.ok(across[1] > nib[1] * 3, "calligraphy is thick across the nib and thin along it");
  assert.equal(pen("nonsense").id, "ballpoint", "an unknown pen falls back to the first");
});

test("single dots and empty strokes are handled", () => {
  assert.ok(outline({ pen: "ballpoint", size: 8, points: [{ x: 5, y: 5 }] }).length >= 8, "a dot is a small circle");
  assert.deepEqual(outline({ pen: "ballpoint", size: 8, points: [] }), []);
  assert.equal(strokePath({ pen: "ballpoint", size: 8, points: [] }), "");
});

test("holding Shift gives a straight line snapped to 45 degrees", () => {
  const wobbly = [{ x: 0, y: 0, t: 0 }, { x: 30, y: 7, t: 10 }, { x: 60, y: -4, t: 20 }, { x: 100, y: 12, t: 30 }];
  const locked = lockPoints(wobbly);
  assert.ok(locked.length > 4);
  assert.ok(locked.every((p) => Math.abs(p.y - 0) < 1e-9), "close to horizontal snaps to exactly horizontal");
  const diagonal = lockPoints([{ x: 0, y: 0, t: 0 }, { x: 50, y: 44, t: 10 }, { x: 100, y: 96, t: 20 }]);
  assert.ok(diagonal.every((p) => Math.abs(p.x - p.y) < 1e-9), "close to diagonal snaps to 45 degrees");
  const vertical = lockPoints([{ x: 5, y: 0, t: 0 }, { x: 9, y: 80, t: 10 }]);
  assert.ok(vertical.every((p) => Math.abs(p.x - 5) < 1e-9));
  assert.deepEqual(lockPoints([{ x: 1, y: 1 }]), [{ x: 1, y: 1 }]);
});

test("the eraser removes only what it touches, splits a stroke in two and spares what it misses", () => {
  const a = line("ballpoint", 60);
  const far = { ...line("marker", 10), id: "far", points: line("marker", 10).points.map((p) => ({ ...p, y: p.y + 500 })) };
  const mid = a.points[30];
  const after = eraseAt([a, far], { x: mid.x, y: mid.y, r: 20 });
  assert.equal(after.includes(far), true, "an untouched stroke is the very same object");
  const pieces = after.filter((s) => s.pen === "ballpoint");
  assert.equal(pieces.length, 2, "the stroke was cut into two pieces");
  assert.ok(pieces[0].points.at(-1).x < mid.x - 10 && pieces[1].points[0].x > mid.x + 10, "a gap is left where the eraser went");
  assert.ok(pieces[0].points.length + pieces[1].points.length > 40, "most of the stroke is kept");
  assert.equal(new Set(after.map((s) => s.id)).size, after.length, "pieces get their own ids");
  assert.equal(eraseAt([{ ...a, points: [mid] }], { x: mid.x, y: mid.y, r: 5 }).length, 0, "a stroke wholly inside vanishes");
  const miss = eraseAt([a], { x: -500, y: -500, r: 10 });
  assert.equal(miss[0], a);
});

test("undo, redo and clear walk through the history, and clearing can be undone", () => {
  const history = new DrawHistory([]);
  history.commit([line("ballpoint", 5)]);
  history.commit([line("ballpoint", 5), line("marker", 5)]);
  assert.equal(history.strokes.length, 2);
  assert.equal(history.undo().length, 1);
  assert.equal(history.redo().length, 2);
  history.clear();
  assert.equal(history.strokes.length, 0);
  assert.equal(history.undo().length, 2, "a cleared drawing comes back with one undo");
  history.undo();
  history.commit([line("pencil", 5)]);
  assert.equal(history.canRedo, false, "drawing again clears the redo list");
  const empty = new DrawHistory([]);
  empty.clear();
  assert.equal(empty.canUndo, false, "clearing nothing is not a step");
});

test("the SVG holds exactly the outlines that are drawn, in order, with each pen's opacity and blending", () => {
  const strokes = [line("ballpoint", 12), line("highlighter", 12), line("calligraphy", 12)];
  const svg = toSvg(strokes, 1200, 800, { background: "#ffffff" });
  const paths = [...svg.matchAll(/<path d="([^"]+)" fill="(#[0-9a-f]{6})" fill-opacity="([\d.]+)"([^/]*)\/>/g)];
  assert.equal(paths.length, 3);
  strokes.forEach((s, i) => {
    assert.equal(paths[i][1], strokePath(s), "the path is the one the canvas fills");
    assert.equal(paths[i][3], String(pen(s.pen).alpha));
  });
  assert.match(paths[1][4], /mix-blend-mode:multiply/);
  assert.doesNotMatch(paths[0][4], /multiply/);
  assert.match(svg, /^<svg [^>]*width="1200" height="800" viewBox="0 0 1200 800">/);
  assert.match(svg, /<rect width="1200" height="800" fill="#ffffff"\/>/);
  // Anything that is not a plain colour or a picture is never copied into the file.
  const hostile = toSvg([{ ...line("ballpoint", 5), color: '"><script>x</script>' }], 10, 10, { background: "red", image: 'data:image/png;base64,AAAA" onload="x' });
  assert.ok(!hostile.includes("<script"));
  assert.match(hostile, /fill="#000000"/);
  assert.match(hostile, /fill="#ffffff"/);
  assert.ok(!/onload="x"/.test(hostile.replace(/&quot;/g, "")) || hostile.includes("&quot;"));
  assert.deepEqual(EXPORT_SCALES, [1, 2, 3], "PNG export offers 1x to 3x");
});

test("a drawing survives being stored and read back, and bad stored data is dropped", () => {
  const strokes = [line("fountain", 20), line("brush", 20)];
  const back = unpackStrokes(packStrokes(strokes));
  assert.equal(back.length, 2);
  assert.deepEqual(back.map((s) => s.pen), ["fountain", "brush"]);
  const numbers = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
  const [x, y] = [numbers(strokePath(back[0])), numbers(strokePath(strokes[0]))];
  assert.equal(x.length, y.length);
  assert.ok(x.every((n, i) => Math.abs(n - y[i]) < 0.1), "the same outline after a restart, within a tenth of a pixel");
  const mixed = JSON.stringify([{ id: "a", pen: "nope", color: "#000000", size: 4, points: [] }, { id: "b", pen: "marker", color: "red", size: 4, points: [] }, { id: "c", pen: "marker", color: "#00ff00", size: 999, points: [[1, 2, 3]] }]);
  const kept = unpackStrokes(mixed);
  assert.deepEqual(kept.map((s) => s.id), ["c"]);
  assert.equal(kept[0].size, 60, "the size is brought into range");
  assert.throws(() => unpackStrokes('{"a":1}'), /not a list/);
});

test("every shortcut is listed once with a label, and the pen keys match the pens", () => {
  const byAction = new Map();
  for (const s of SHORTCUTS) byAction.set(s.action, [...(byAction.get(s.action) ?? []), s.keys]);
  for (const p of PENS) assert.deepEqual(byAction.get(`pen:${p.id}`), [p.key]);
  for (const action of ["eraser", "undo", "redo", "clear", "lock", "smaller", "larger", "toolbar"]) assert.ok(byAction.has(action), action);
  assert.ok(SHORTCUTS.every((s) => s.label.en && s.label.yue));
});

test("the module is well formed, its stylesheet is loaded and both are served", async () => {
  assert.equal(checkFeatureModule(feature, "drawesome-drawing"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/drawesome-drawing/index.js"));
    assert.ok(manifest.styles.includes("/js/features/drawesome-drawing/style.css"));
    assert.equal((await fetch(`${t.base}/js/features/drawesome-drawing/style.css`)).status, 200);
  } finally {
    await t.stop();
  }
});
