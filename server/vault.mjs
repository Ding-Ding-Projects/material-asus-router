// Encrypted storage for router credentials and other secret values.
// AES-256-GCM with a random key kept in its own file on the data volume
// (mode 0600). Values never appear in logs, API responses or state.json.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class Vault {
  constructor(dir) {
    this.dir = dir;
    this.keyFile = path.join(dir, "vault.key");
    this.file = path.join(dir, "vault.json");
    this.entries = {};
    this.queue = Promise.resolve();
  }

  async load() {
    await mkdir(this.dir, { recursive: true });
    try {
      this.key = await readFile(this.keyFile);
      if (this.key.length !== 32) throw new Error("The vault key file is damaged.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.key = randomBytes(32);
      await writeFile(this.keyFile, this.key, { mode: 0o600, flag: "wx" });
    }
    try {
      this.entries = JSON.parse(await readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return this;
  }

  has(name) {
    return Object.hasOwn(this.entries, name);
  }

  get(name) {
    const entry = this.entries[name];
    if (!entry) return null;
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(entry.iv, "base64"));
    decipher.setAAD(Buffer.from(name));
    decipher.setAuthTag(Buffer.from(entry.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(entry.data, "base64")), decipher.final()]).toString("utf8");
  }

  set(name, value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(name));
    const data = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    this.entries[name] = { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
    return this.save();
  }

  delete(name) {
    delete this.entries[name];
    return this.save();
  }

  save() {
    const run = this.queue.then(async () => {
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.entries), { mode: 0o600 });
      await rename(tmp, this.file);
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
