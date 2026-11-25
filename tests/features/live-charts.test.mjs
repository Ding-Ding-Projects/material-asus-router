// Tests for the live chart's model: axis ceilings, smooth paths, gaps that stay
// gaps, scrub lookups and the spoken summary. The chart never invents a point.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/live-charts/index.js";
import { formatRate, layout, nearestIndex, niceMax, segments, smoothPath, summary } from "../../public/js/features/live-charts/chart-model.js";
import { INTERVAL_MS } from "../../public/js/features/live-charts/traffic.js";
import { readSources } from "./fakes.mjs";

const pts = (vals, step = 2000, t0 = 1_000_000) => vals.map((v, i) => ({ t: t0 + i * step, v }));

test("live-charts: the module is well formed and polls every two seconds", () => {
  assert.equal(checkFeatureModule(feature, "live-charts"), null);
  assert.equal(INTERVAL_MS, 2000);
});

test("live-charts: tidy axis ceilings and readable rates", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(-4), 1);
  assert.equal(niceMax(0.9), 1);
  assert.equal(niceMax(1.1), 2);
  assert.equal(niceMax(2.3), 2.5);
  assert.equal(niceMax(41), 50);
  assert.equal(niceMax(61.4e6), 100e6);
  assert.equal(formatRate(0), "0 bit/s");
  assert.equal(formatRate(1500), "2 kbit/s");
  assert.equal(formatRate(61.4e6), "61.4 Mbit/s");
  assert.equal(formatRate(2.5e9), "2.50 Gbit/s");
  assert.equal(formatRate(-5), "0 bit/s");
  assert.equal(formatRate(NaN), "0 bit/s");
});

test("live-charts: a gap in the readings stays a gap, so nothing is invented", () => {
  const a = pts([1, 2, 3], 2000, 0);
  const b = pts([4, 5], 2000, 60000);
  const runs = segments([...a, ...b], 8000);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((r) => r.length), [3, 2]);
  assert.equal(segments([], 8000).length, 0);
  assert.equal(segments(pts([1]), 8000).length, 1);
  const d = [...runs].map((r) => smoothPath(r.map((p, i) => [i * 10, 100 - p.v]))).join(" ");
  assert.equal((d.match(/M/g) ?? []).length, 2, "two separate lines, nothing drawn across the gap");
});

test("live-charts: the smooth path stays inside the data (no overshoot) and starts on the first point", () => {
  const xy = [[0, 100], [10, 100], [20, 20], [30, 20], [40, 90], [50, 10]];
  const d = smoothPath(xy);
  assert.ok(d.startsWith("M0.0,100.0"));
  const nums = [...d.matchAll(/(-?\d+\.\d)/g)].map((m) => Number(m[1]));
  const ys = nums.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...ys) >= 10 - 0.01 && Math.max(...ys) <= 100 + 0.01, "no control point leaves the range of the data");
  assert.equal(smoothPath([]), "");
  assert.equal(smoothPath([[5, 5]]), "M5.0,5.0");
});

test("live-charts: layout maps time to x and value to y, and scrubbing finds the nearest real sample", () => {
  const data = pts([0, 50, 100], 1000, 10000);
  const laid = layout(data, { end: 12000, windowMs: 2000, width: 600, height: 160, pad: { l: 8, r: 10, t: 14, b: 22 }, max: 100 });
  assert.equal(laid.length, 3);
  assert.equal(Math.round(laid[0].x), 8);
  assert.equal(Math.round(laid[2].x), 590);
  assert.ok(laid[0].y > laid[1].y && laid[1].y > laid[2].y, "bigger values are higher");
  assert.equal(Math.round(laid[0].y), 138);
  assert.equal(Math.round(laid[2].y), 14);
  assert.equal(nearestIndex(laid, 0), 0);
  assert.equal(nearestIndex(laid, 300), 1);
  assert.equal(nearestIndex(laid, 9999), 2);
  assert.equal(nearestIndex([], 5), -1);
  const old = layout(pts([1, 2, 3], 1000, 0), { end: 100000, windowMs: 2000, width: 600, height: 160, pad: { l: 8, r: 10, t: 14, b: 22 }, max: 5 });
  assert.equal(old.length, 0, "samples older than the window are not drawn");
});

test("live-charts: the spoken summary is honest about loading, paused and out-of-date data", () => {
  const f = (v) => `${v} units`;
  assert.match(summary([], { format: f, label: "Download", state: "loading" }), /loading, no samples yet/);
  assert.match(summary([], { format: f, label: "Download", state: "empty" }), /no samples yet/);
  const live = summary(pts([5, 9, 7]), { format: f, label: "Download", state: "live" });
  assert.match(live, /now 7 units, lowest 5 units, highest 9 units, from 3 samples/);
  assert.ok(!/paused|out of date/.test(live));
  assert.match(summary(pts([1]), { format: f, label: "x", state: "paused" }), /paused/);
  assert.match(summary(pts([1]), { format: f, label: "x", state: "stale" }), /out of date/);
});

test("live-charts: the chart code has keyboard scrubbing, snaps under reduced motion, and never fabricates readings", async () => {
  const src = (await readSources("live-charts"))["chart.js"];
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"]) assert.ok(src.includes(key), `${key} scrubs`);
  assert.ok(src.includes("reducedNow()"), "motion state decides easing");
  assert.ok(/if \(snap\(\)\)/.test(src), "reduced motion snaps");
  assert.ok(!/Math\.random/.test(src), "no random data");
  const traffic = (await readSources("live-charts"))["traffic.js"];
  assert.ok(!/Math\.random/.test(traffic), "no random data");
  assert.ok(/markStale\(\)/.test(traffic), "a failed read marks the data out of date");
  assert.ok(/aria-label/.test(src) && /role: "slider"/.test(src), "a screen reader gets a label and a value");
});
