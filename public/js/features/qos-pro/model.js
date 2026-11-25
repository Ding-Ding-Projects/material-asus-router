// Small pure helpers for the traffic-priority screen. It imports nothing, so
// the tests can import it too.

// "9,20<4<0,5" to [["9","20"],["4"],["0","5"]]; empty or invalid text is [].
export const parseOrder = (text) => String(text ?? "").split("<").filter(Boolean).map((group) => group.split(",").filter(Boolean));
export const formatOrder = (groups) => groups.map((g) => g.join(",")).join("<");

// Moves one group from one place to another in the order, returning a new list.
export function moveGroup(groups, from, to) {
  if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return groups;
  const next = [...groups];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// A speed in kbit/s as a readable text with its unit: 20000 gives "20 Mbit/s".
export function rateText(kbit) {
  const n = Number(kbit);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n >= 1000000) return `${trim(n / 1000000)} Gbit/s`;
  if (n >= 1000) return `${trim(n / 1000)} Mbit/s`;
  return `${n} kbit/s`;
}
const trim = (n) => String(Math.round(n * 10) / 10);

// Finds the speed test feature, if this build has one, from the manifest.
export const SPEED_TEST_IDS = ["speedtest", "speed-test"];
export const findSpeedTest = (manifest) => SPEED_TEST_IDS.find((id) => (manifest?.server ?? []).includes(id)) ?? null;

// Reads a speed test result in kbit/s. Returns null when it has no figure it
// knows how to read, so the screen says so instead of guessing.
export function readSpeed(result) {
  const pick = (kbit, mbit) => (Number.isFinite(Number(result?.[kbit])) && result[kbit] !== null ? Number(result[kbit]) : Number.isFinite(Number(result?.[mbit])) && result?.[mbit] !== null ? Number(result[mbit]) * 1000 : null);
  const down = pick("downloadKbit", "downloadMbit");
  const up = pick("uploadKbit", "uploadMbit");
  return down === null || up === null ? null : { down: Math.round(down), up: Math.round(up) };
}

// What to set the line speed to: a little under the measured speed, so the
// router keeps control of the queue (90 percent, never zero).
export const plannedSpeed = (kbit) => Math.max(1, Math.round(kbit * 0.9));
