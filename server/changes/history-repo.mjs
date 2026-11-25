// The local configuration history: a version-control repository kept inside the app's
// data folder and driven by isomorphic-git, which is plain JavaScript, so no
// git program is ever run. Every applied change, undo and restore becomes one
// commit of readable snapshot files. Nothing here ever pushes anywhere.
import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";
import { RAW_FILE, areaFile, parseSnapshotFiles } from "./snapshot.mjs";

const SNAPSHOT_CACHE = 40;
const MAX_REGEX = 200;
const BAD_REGEX = /\([^)]*[+*][^)]*\)[+*{]|\\\d|\(\?[<=!]/;
const TRAILER = /^([A-Za-z][A-Za-z-]*): (.*)$/;

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const fsp = fs.promises;

export function parseMessage(message) {
  const text = String(message ?? "").replace(/\r\n/g, "\n").trim();
  const paragraphs = text.split(/\n\n+/);
  const trailers = {};
  let body = paragraphs;
  const last = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1].split("\n") : [];
  if (last.length && last.every((line) => TRAILER.test(line))) {
    for (const line of last) {
      const [, k, v] = line.match(TRAILER);
      trailers[k.toLowerCase()] = v;
    }
    body = paragraphs.slice(0, -1);
  }
  const subject = body[0]?.split("\n")[0] ?? "";
  return { subject, body: body.join("\n\n").split("\n").slice(1).join("\n").trim(), trailers };
}

export function buildMessage({ subject, body = "", trailers = {} }) {
  const lines = Object.entries(trailers).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}: ${String(v).replace(/[\r\n]+/g, " ")}`);
  return [String(subject).replace(/[\r\n]+/g, " ").trim(), body.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
}

export function compileRegex(source) {
  const text = String(source ?? "");
  if (!text) return null;
  if (text.length > MAX_REGEX) throw bad(`The pattern is longer than ${MAX_REGEX} characters.`);
  if (BAD_REGEX.test(text)) throw bad("That pattern can take too long to run. Use a simpler one.");
  try {
    return new RegExp(text, "i");
  } catch (error) {
    throw bad(`That is not a valid pattern: ${error.message}`);
  }
}

export class ConfigHistory {
  constructor({ dir, now = () => Date.now() }) {
    this.dir = dir;
    this.now = now;
    this.queue = Promise.resolve();
    this.ready = null;
    this.cache = new Map();
    this.commits = null;
  }

  #serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async #init() {
    this.ready ??= (async () => {
      await fsp.mkdir(this.dir, { recursive: true });
      const hasRepo = await fsp.stat(path.join(this.dir, ".git")).catch(() => null);
      if (!hasRepo) await git.init({ fs, dir: this.dir, defaultBranch: "main" });
    })();
    return this.ready;
  }

  async isEmpty() {
    await this.#init();
    return !(await git.resolveRef({ fs, dir: this.dir, ref: "HEAD" }).catch(() => null));
  }

  // files: Map(path -> text). Writes them, removes tracked files that are gone, commits.
  record({ files, subject, body, trailers, author }) {
    return this.#serial(async () => {
      await this.#init();
      const tracked = await git.listFiles({ fs, dir: this.dir }).catch(() => []);
      for (const [file, text] of files) {
        const full = path.join(this.dir, file);
        await fsp.mkdir(path.dirname(full), { recursive: true });
        await fsp.writeFile(full, text, "utf8");
        await git.add({ fs, dir: this.dir, filepath: file });
      }
      for (const file of tracked) {
        if (files.has(file)) continue;
        await fsp.rm(path.join(this.dir, file), { force: true });
        await git.remove({ fs, dir: this.dir, filepath: file });
      }
      const when = Math.floor(this.now() / 1000);
      const who = { name: author.name, email: author.email, timestamp: when, timezoneOffset: 0 };
      const oid = await git.commit({ fs, dir: this.dir, message: buildMessage({ subject, body, trailers }), author: who, committer: who });
      this.commits = null;
      return oid;
    });
  }

  async #commitList() {
    await this.#init();
    if (this.commits) return this.commits;
    const head = await git.resolveRef({ fs, dir: this.dir, ref: "HEAD" }).catch(() => null);
    if (!head) return (this.commits = []);
    const raw = await git.log({ fs, dir: this.dir, ref: "HEAD" });
    const marks = await this.#bookmarkMap();
    this.commits = raw.map(({ oid, commit }) => {
      const { subject, body, trailers } = parseMessage(commit.message);
      const keys = (trailers.keys ?? "").split(",").filter(Boolean);
      return {
        oid,
        parents: commit.parent,
        subject,
        body,
        person: commit.author.name,
        email: commit.author.email,
        at: new Date(commit.author.timestamp * 1000).toISOString(),
        mode: trailers.mode ?? "review",
        source: trailers.source ?? "change",
        impact: Number(trailers.impact ?? 0),
        guard: trailers.guard ?? "none",
        keys,
        areas: (trailers.areas ?? "").split(",").filter(Boolean),
        changeId: trailers["change-id"] ?? null,
        runId: trailers.run ?? null,
        override: trailers.override ?? null,
        bookmarks: marks.get(oid) ?? [],
      };
    });
    return this.commits;
  }

  invalidate() {
    this.commits = null;
  }

  async list({ area, person, mode, source, impact, since, until, text, regex, key, limit = 50, offset = 0 } = {}) {
    const commits = await this.#commitList();
    const re = compileRegex(regex);
    const needle = text ? String(text).toLowerCase() : "";
    const from = since ? Date.parse(since) : null;
    const to = until ? Date.parse(until) : null;
    if ((since && Number.isNaN(from)) || (until && Number.isNaN(to))) throw bad("Dates must look like 2026-11-25 or 2026-11-25T09:30:00Z.");
    const found = commits.filter((c) => {
      if (area && !c.areas.includes(area)) return false;
      if (person && !c.person.toLowerCase().includes(String(person).toLowerCase())) return false;
      if (mode && c.mode !== mode) return false;
      if (source && c.source !== source) return false;
      if (impact !== undefined && impact !== "" && c.impact !== Number(impact)) return false;
      if (key && !c.keys.includes(key)) return false;
      const time = Date.parse(c.at);
      if (from !== null && time < from) return false;
      if (to !== null && time > to) return false;
      const haystack = `${c.subject}\n${c.body}\n${c.keys.join(" ")}`.slice(0, 4000);
      if (needle && !haystack.toLowerCase().includes(needle)) return false;
      if (re && !re.test(haystack)) return false;
      return true;
    });
    const start = Math.max(Number(offset) || 0, 0);
    const size = Math.min(Math.max(Number(limit) || 50, 1), 500);
    return { total: found.length, items: found.slice(start, start + size) };
  }

  async get(oid) {
    const commit = (await this.#commitList()).find((c) => c.oid === this.#oid(oid));
    if (!commit) throw bad("That version is not in the history.", 404);
    return commit;
  }

  #oid(oid) {
    const text = String(oid ?? "");
    if (!/^[0-9a-f]{7,40}$/.test(text)) throw bad("That is not a version id.", 400);
    return text;
  }

  async resolve(oid) {
    const text = this.#oid(oid);
    const list = await this.#commitList();
    const hits = list.filter((c) => c.oid.startsWith(text));
    if (!hits.length) throw bad("That version is not in the history.", 404);
    if (hits.length > 1 && text.length < 40) throw bad("That id matches more than one version. Use more characters.", 400);
    return hits[0];
  }

  // Map(key -> record) for one commit.
  async snapshotAt(oid) {
    await this.#init();
    if (this.cache.has(oid)) return this.cache.get(oid);
    const files = (await git.listFiles({ fs, dir: this.dir, ref: oid })).filter((f) => f.startsWith("areas/"));
    const texts = new Map();
    for (const file of files) {
      const { blob } = await git.readBlob({ fs, dir: this.dir, oid, filepath: file });
      texts.set(file, Buffer.from(blob).toString("utf8"));
    }
    const snapshot = parseSnapshotFiles(texts);
    this.cache.set(oid, snapshot);
    while (this.cache.size > SNAPSHOT_CACHE) this.cache.delete(this.cache.keys().next().value);
    return snapshot;
  }

  async rawKeys() {
    const head = await git.resolveRef({ fs, dir: this.dir, ref: "HEAD" }).catch(() => null);
    if (!head) return [];
    const { blob } = await git.readBlob({ fs, dir: this.dir, oid: head, filepath: RAW_FILE }).catch(() => ({ blob: null }));
    if (!blob) return [];
    try {
      return (JSON.parse(Buffer.from(blob).toString("utf8")).settings ?? []).map((s) => s.key);
    } catch {
      return [];
    }
  }

  static diffMaps(before, after) {
    const changes = [];
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      const a = before.get(key);
      const b = after.get(key);
      const oldValue = a ? a.value : null;
      const newValue = b ? b.value : null;
      if (oldValue === newValue) continue;
      const ref = b ?? a;
      changes.push({ key, id: ref.id ?? null, area: ref.area, label: ref.label, secret: Boolean(ref.secret), old: oldValue, new: newValue });
    }
    return changes.sort((x, y) => `${x.area}/${x.key}`.localeCompare(`${y.area}/${y.key}`));
  }

  // One version against its parent, or any version against another.
  async diff(a, b = null) {
    const first = await this.resolve(a);
    let before;
    let after;
    if (b) {
      const second = await this.resolve(b);
      [before, after] = [await this.snapshotAt(first.oid), await this.snapshotAt(second.oid)];
      return { from: first.oid, to: second.oid, changes: ConfigHistory.diffMaps(before, after) };
    }
    const parent = first.parents[0];
    before = parent ? await this.snapshotAt(parent) : new Map();
    after = await this.snapshotAt(first.oid);
    return { from: parent ?? null, to: first.oid, changes: ConfigHistory.diffMaps(before, after) };
  }

  // Every version that changed one setting, newest first, with its old and new value.
  async settingHistory(keyOrId) {
    const commits = await this.#commitList();
    const head = commits[0];
    let key = String(keyOrId ?? "");
    if (head) {
      const latest = await this.snapshotAt(head.oid);
      const hit = [...latest.values()].find((r) => r.id === key);
      if (hit) key = hit.key;
    }
    const out = [];
    for (const commit of commits.filter((c) => c.keys.includes(key))) {
      const before = commit.parents[0] ? await this.snapshotAt(commit.parents[0]) : new Map();
      const after = await this.snapshotAt(commit.oid);
      const oldValue = before.get(key)?.value ?? null;
      const newValue = after.get(key)?.value ?? null;
      out.push({ oid: commit.oid, at: commit.at, person: commit.person, mode: commit.mode, source: commit.source, subject: commit.subject, old: oldValue, new: newValue, label: (after.get(key) ?? before.get(key))?.label ?? { en: key, yue: key } });
    }
    return { key, items: out };
  }

  // What would put the router's settings back to one version. `current` is a
  // Map(key -> record) of the router right now (secrets masked the same way).
  async restorePlan(oid, current, { key = null, id = null } = {}) {
    const target = await this.snapshotAt((await this.resolve(oid)).oid);
    const changes = [];
    const skipped = [];
    for (const record of target.values()) {
      if (key && record.key !== key) continue;
      if (id && record.id !== id) continue;
      const now = current.get(record.key);
      if (now && now.value === record.value) continue;
      if (record.secret) {
        skipped.push({ key: record.key, label: record.label, reason: "A secret value is not kept in the history, so it cannot be restored." });
        continue;
      }
      if (record.value === null) {
        skipped.push({ key: record.key, label: record.label, reason: "The setting did not exist in that version." });
        continue;
      }
      changes.push(record.id ? { id: record.id, value: record.value } : { key: record.key, value: record.value });
    }
    if ((key || id) && !changes.length && !skipped.length) throw bad("That setting already has the value it had then.", 400);
    return { changes, skipped };
  }

  // ---- bookmarks (annotated tags) -----------------------------------------

  async #bookmarkMap() {
    const map = new Map();
    const tags = await git.listTags({ fs, dir: this.dir }).catch(() => []);
    for (const name of tags) {
      if (!name.startsWith("bm-")) continue;
      try {
        const ref = await git.resolveRef({ fs, dir: this.dir, ref: `refs/tags/${name}` });
        const { tag } = await git.readTag({ fs, dir: this.dir, oid: ref });
        const meta = JSON.parse(tag.message);
        if (!map.has(tag.object)) map.set(tag.object, []);
        map.get(tag.object).push({ id: name, label: meta.label, note: meta.note ?? "", by: tag.tagger.name, at: new Date(tag.tagger.timestamp * 1000).toISOString() });
      } catch {
        /* a tag we did not write */
      }
    }
    return map;
  }

  async bookmarks() {
    const list = await this.#commitList();
    return list.flatMap((c) => c.bookmarks.map((b) => ({ ...b, oid: c.oid, subject: c.subject })));
  }

  addBookmark(oid, { label, note = "", by, email }) {
    return this.#serial(async () => {
      const commit = await this.resolve(oid);
      const text = String(label ?? "").trim();
      if (!text || text.length > 60) throw bad("Give the bookmark a label of 1 to 60 characters.");
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "mark";
      const id = `bm-${slug}-${Math.floor(this.now() / 1000).toString(36)}`;
      const tagger = { name: by, email, timestamp: Math.floor(this.now() / 1000), timezoneOffset: 0 };
      await git.annotatedTag({ fs, dir: this.dir, ref: id, object: commit.oid, message: JSON.stringify({ label: text, note: String(note).slice(0, 300) }), tagger });
      this.commits = null;
      return { id, oid: commit.oid, label: text, note: String(note).slice(0, 300), by, at: new Date(tagger.timestamp * 1000).toISOString() };
    });
  }

  removeBookmark(id) {
    return this.#serial(async () => {
      if (!/^bm-[a-z0-9-]+$/.test(String(id))) throw bad("That is not a bookmark.", 404);
      const exists = (await git.listTags({ fs, dir: this.dir })).includes(id);
      if (!exists) throw bad("That bookmark does not exist.", 404);
      await git.deleteTag({ fs, dir: this.dir, ref: id });
      this.commits = null;
      return { ok: true };
    });
  }

  // ---- statistics and export ------------------------------------------------

  async stats({ limit = 10 } = {}) {
    const commits = await this.#commitList();
    const head = commits[0];
    const latest = head ? await this.snapshotAt(head.oid) : new Map();
    const perKey = new Map();
    const perDay = new Map();
    const perPerson = new Map();
    const perMode = new Map();
    const perImpact = [0, 0, 0, 0];
    for (const c of commits) {
      for (const key of c.keys) perKey.set(key, (perKey.get(key) ?? 0) + 1);
      const day = c.at.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      perPerson.set(c.person, (perPerson.get(c.person) ?? 0) + 1);
      perMode.set(c.mode, (perMode.get(c.mode) ?? 0) + 1);
      perImpact[Math.min(Math.max(c.impact, 0), 3)] += 1;
    }
    const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);
    return {
      total: commits.length,
      mostChanged: sorted(perKey).slice(0, limit).map(([key, count]) => ({ key, count, id: latest.get(key)?.id ?? null, label: latest.get(key)?.label ?? { en: key, yue: key } })),
      perDay: [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
      perPerson: sorted(perPerson).map(([person, count]) => ({ person, count })),
      perMode: sorted(perMode).map(([mode, count]) => ({ mode, count })),
      perImpact: perImpact.map((count, level) => ({ level, count })),
    };
  }

  async export({ format = "json", limit = 1000 } = {}) {
    const commits = (await this.#commitList()).slice(0, Math.min(limit, 5000));
    const rows = [];
    for (const commit of commits) {
      const { changes } = await this.diff(commit.oid);
      rows.push({ ...commit, changes });
    }
    if (format === "csv") {
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [["version", "date", "person", "mode", "source", "impact", "guard", "area", "setting", "old", "new"].join(",")];
      for (const r of rows) for (const c of r.changes.length ? r.changes : [{}]) lines.push([r.oid.slice(0, 10), r.at, r.person, r.mode, r.source, r.impact, r.guard, c.area ?? "", c.key ?? "", c.old ?? "", c.new ?? ""].map(esc).join(","));
      return { type: "text/csv; charset=utf-8", body: `${lines.join("\n")}\n`, name: "router-config-history.csv" };
    }
    return { type: "application/json; charset=utf-8", body: JSON.stringify({ format: "material-asus-router-history", version: 1, exportedAt: new Date(this.now()).toISOString(), commits: rows }, null, 2), name: "router-config-history.json" };
  }
}

export { areaFile };
