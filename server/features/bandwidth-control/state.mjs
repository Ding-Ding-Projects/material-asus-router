// Small durable state for this feature: one JSON file in the app's data folder
// (DATA_DIR, the same folder the app keeps its own state in). Writes are
// queued and replace the file atomically, so a crash never leaves half a file.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function featureState(id, fallback) {
  const file = () => path.join(path.resolve(process.env.DATA_DIR ?? "./data"), "features", `${id}.json`);
  let queue = Promise.resolve();
  return {
    async read() {
      try {
        return { ...structuredClone(fallback), ...JSON.parse(await readFile(file(), "utf8")) };
      } catch {
        return structuredClone(fallback);
      }
    },
    // update(fn): fn receives the state, may change it and may return a value.
    update(fn) {
      const run = queue.then(async () => {
        const draft = await this.read();
        const result = await fn(draft);
        await mkdir(path.dirname(file()), { recursive: true });
        const tmp = `${file()}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(draft), { mode: 0o600 });
        await rename(tmp, file());
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
