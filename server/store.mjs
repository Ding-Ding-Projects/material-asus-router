// Serialized JSON state on the data volume. Every change goes through
// `update`, which runs one transaction at a time and replaces the file
// atomically, so a crash never leaves half-written state behind.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, "state.json");
    this.queue = Promise.resolve();
    this.state = null;
  }

  async load() {
    await mkdir(this.dir, { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = { owner: null, users: [], router: null, history: [], settings: {} };
    }
    this.state.users ??= [];
    this.state.history ??= [];
    this.state.settings ??= {};
    return this;
  }

  read() {
    return structuredClone(this.state);
  }

  update(fn) {
    const run = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = await fn(draft);
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(draft, null, 2), { mode: 0o600 });
      await rename(tmp, this.file);
      this.state = draft;
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
