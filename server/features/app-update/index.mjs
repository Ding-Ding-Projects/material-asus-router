// App updates: the owner updates the app from its own screen, or lets it update every night.
// The app never touches Docker. It writes a request into the folder it shares with the updater
// service (updater/updater.sh, started by compose.update.yaml) and reads the answer:
//   request.txt   written here: id=<id> action=check|apply by=<name>
//   status.txt    written by the updater: key=value lines
//   history.log   written by the updater: time|event|detail|by
//   heartbeat.txt written by the updater every few seconds
// The updater pins the newest build's exact image, waits for its health check, and puts the
// previous version back by itself if the new one does not answer.
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { L } from "../kit.mjs";
import { featureState } from "./state.mjs";

const ID = "app-update";
export const NIGHT_TIMES = ["02:00", "03:00", "04:00"];
const store = featureState(ID, { auto: { enabled: false, time: "03:00", offsetMinutes: 0 }, lastNight: "" });
const HEARTBEAT_MS = 30000;

export const updatesDir = () => process.env.UPDATES_DIR || "";

const parseStatus = (text) => {
  const out = {};
  for (const line of String(text).split("\n")) {
    const m = /^([a-z_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
};

const parseHistory = (text) => String(text).split("\n").filter(Boolean).slice(-30).reverse().map((line) => {
  const [at, event, detail, by] = line.split("|");
  return { at, event, detail: detail ?? "", by: by ?? "" };
});

export async function readUpdater(dir = updatesDir(), now = Date.now()) {
  if (!dir) return { configured: false, reason: "not-set-up" };
  const read = (name) => readFile(path.join(dir, name), "utf8").catch(() => "");
  const [beat, status, history] = await Promise.all([read("heartbeat.txt"), read("status.txt"), read("history.log")]);
  const last = Number(beat.trim()) * 1000;
  const alive = Number.isFinite(last) && last > 0 && now - last < HEARTBEAT_MS;
  return { configured: true, alive, status: parseStatus(status), history: parseHistory(history) };
}

// The only text the app writes for the updater: a fixed shape with a random id and a cleaned name.
export async function request(action, by, dir = updatesDir()) {
  if (!["check", "apply"].includes(action)) throw new Error("Unknown action.");
  const id = randomUUID();
  const name = String(by ?? "").replace(/[^A-Za-z0-9 ._-]/g, "").slice(0, 40) || "owner";
  const tmp = path.join(dir, `request.${process.pid}.tmp`);
  await writeFile(tmp, `id=${id} action=${action} by=${name}\n`, { mode: 0o644 });
  await rename(tmp, path.join(dir, "request.txt"));
  return id;
}

const running = () => ({ version: process.env.APP_VERSION || "0.1.0", revision: String(process.env.SOURCE_REVISION || "").slice(0, 12), built: process.env.BUILD_DATE || "" });

// The nightly update: once a day, at the chosen local time (the owner's browser gave its offset).
export async function nightTick(now = new Date(), dir = updatesDir()) {
  if (!dir) return false;
  const s = await store.read();
  if (!s.auto?.enabled) return false;
  const local = new Date(now.getTime() + (Number(s.auto.offsetMinutes) || 0) * 60000);
  const hhmm = local.toISOString().slice(11, 16);
  const day = local.toISOString().slice(0, 10);
  if (hhmm !== s.auto.time || s.lastNight === day) return false;
  await store.update((x) => { x.lastNight = day; });
  await request("apply", "night", dir);
  return true;
}

let timer = null;
function startTimer() {
  if (timer || !updatesDir()) return;
  timer = setInterval(() => nightTick().catch(() => {}), 30000);
  timer.unref?.();
}

const ownerOnly = (who, bad) => {
  if (who.role !== "owner") throw bad("Only the owner can update the app.", 403);
};

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "system_update", label: L("App updates", "程式更新"), group: L("System", "系統") }],
  domains: {
    [ID]: async () => {
      const s = await store.read();
      return { running: running(), updater: await readUpdater(), auto: s.auto, nightTimes: NIGHT_TIMES };
    },
  },
  routes(api) {
    startTimer();
    const need = (bad) => {
      if (!updatesDir()) throw bad("The updater is not set up. Start the app with compose.update.yaml as well.", 409);
    };
    api.post("/check", async ({ who, bad }) => {
      ownerOnly(who, bad);
      need(bad);
      return { id: await request("check", who.name) };
    });
    api.post("/apply", async ({ who, bad }) => {
      ownerOnly(who, bad);
      need(bad);
      return { id: await request("apply", who.name) };
    });
    api.put("/auto", async ({ body, who, bad }) => {
      ownerOnly(who, bad);
      const time = String(body.time ?? "03:00");
      if (!NIGHT_TIMES.includes(time)) throw bad(`Choose ${NIGHT_TIMES.join(", ")}.`);
      const offsetMinutes = Number(body.offsetMinutes ?? 0);
      if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 14 * 60) throw bad("The time zone offset is not valid.");
      const auto = { enabled: body.enabled === true, time, offsetMinutes };
      await store.update((s) => { s.auto = auto; });
      return { auto };
    });
  },
};
