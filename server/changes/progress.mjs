// Live progress for anything that takes time: a change, an undo, a reboot.
// Each run is a list of steps with timestamps. A browser can read the whole
// run, or open an event stream that replays the steps so far and then follows
// new ones until the run is really finished (the router answered and its
// settings read back).
import { randomUUID } from "node:crypto";

const KEEP_RUNS = 100;
const HEARTBEAT_MS = 15000;

export const step = (en, yue) => ({ en, yue });

export class ProgressHub {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.runs = new Map();
    this.listeners = new Map();
  }

  start({ kind, title, user = "", meta = {} }) {
    const run = { id: randomUUID(), kind, title, user, status: "running", startedAt: new Date(this.now()).toISOString(), finishedAt: null, steps: [], meta };
    this.runs.set(run.id, run);
    while (this.runs.size > KEEP_RUNS) this.runs.delete(this.runs.keys().next().value);
    return run.id;
  }

  // state: "running" | "done" | "failed" | "info" | "waiting"
  step(id, key, label, state = "done", detail = "") {
    const run = this.runs.get(id);
    if (!run || run.finishedAt) return;
    const previous = run.steps.find((s) => s.key === key);
    const entry = { seq: run.steps.length + 1, key, label, state, detail: String(detail ?? ""), at: new Date(this.now()).toISOString() };
    if (previous) Object.assign(previous, { label, state, detail: entry.detail, at: entry.at, seq: previous.seq });
    else run.steps.push(entry);
    this.#emit(id, "step", previous ?? entry);
  }

  // status: "done" | "failed" | "guarded" | "timeout" | "cancelled"
  finish(id, status, note = "") {
    const run = this.runs.get(id);
    if (!run || run.finishedAt) return;
    run.status = status;
    run.note = String(note ?? "");
    run.finishedAt = new Date(this.now()).toISOString();
    this.#emit(id, "end", { status, note: run.note, finishedAt: run.finishedAt });
  }

  get(id) {
    const run = this.runs.get(id);
    return run ? structuredClone(run) : null;
  }

  list() {
    return [...this.runs.values()].reverse().map(({ steps, ...rest }) => ({ ...rest, stepCount: steps.length }));
  }

  subscribe(id, fn) {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id).add(fn);
    return () => this.listeners.get(id)?.delete(fn);
  }

  #emit(id, event, data) {
    for (const fn of this.listeners.get(id) ?? []) fn(event, data);
    if (event === "end") this.listeners.delete(id);
  }

  // Writes an event stream for one run into `res`. Resolves when the run ends
  // or the browser goes away.
  stream(id, req, res) {
    const run = this.runs.get(id);
    if (!run) return false;
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("run", { id: run.id, kind: run.kind, title: run.title, startedAt: run.startedAt, status: run.status });
    for (const s of run.steps) send("step", s);
    return new Promise((resolve) => {
      let timer = null;
      let off = () => {};
      const close = () => {
        clearInterval(timer);
        off();
        if (!res.writableEnded) res.end();
        resolve();
      };
      if (run.finishedAt) {
        send("end", { status: run.status, note: run.note ?? "", finishedAt: run.finishedAt });
        return close();
      }
      off = this.subscribe(id, (event, data) => {
        send(event, data);
        if (event === "end") close();
      });
      timer = setInterval(() => res.write(": keep-alive\n\n"), HEARTBEAT_MS);
      timer.unref?.();
      req.on("close", close);
    });
  }
}
