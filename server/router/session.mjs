// The app's one long-lived link to the router. It reconnects on demand, keeps
// the cached settings and detected capabilities, and can open a second,
// independent connection for the "can I still reach the router?" check.
import { RouterConnection } from "../ssh/client.mjs";
import { NvramCache, detect } from "./detect.mjs";
import { buildCatalog } from "./catalog.mjs";

export const VAULT_PASSWORD = "router.password";
export const VAULT_PRIVATE_KEY = "router.privateKey";
export const VAULT_PUBLIC_KEY = "router.publicKey";

export class RouterSession {
  constructor({ store, vault, verifyTimeoutMs = 8000, cacheTtlMs = 5000 }) {
    this.store = store;
    this.vault = vault;
    this.verifyTimeoutMs = verifyTimeoutMs;
    this.connection = null;
    this.connecting = null;
    this.cache = new NvramCache((command) => this.exec(command), { ttlMs: cacheTtlMs });
    this.detected = null;
    this.detectedFor = null;
    this.netSample = null;
  }

  get config() {
    return this.store.read().router;
  }

  get configured() {
    return Boolean(this.config?.host);
  }

  get connected() {
    return Boolean(this.connection?.connected);
  }

  connectionOptions(config = this.config, overrides = {}) {
    if (!config?.host) throw Object.assign(new Error("Connect a router first."), { status: 409, code: "NO_ROUTER" });
    const options = { host: config.host, port: config.port ?? 22, username: config.username, hostKey: config.hostKey, ...overrides };
    if (config.authType === "key") {
      options.privateKey = this.vault.get(VAULT_PRIVATE_KEY);
      if (!options.privateKey) throw Object.assign(new Error("The router key is missing. Generate one again."), { status: 409 });
    } else {
      options.password = this.vault.get(VAULT_PASSWORD) ?? undefined;
    }
    return options;
  }

  async ensure() {
    if (this.connection?.connected) return this.connection;
    this.connecting ??= (async () => {
      try {
        const connection = new RouterConnection(this.connectionOptions());
        await connection.connect();
        this.connection = connection;
        return connection;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  async exec(command, options) {
    const connection = await this.ensure();
    return connection.exec(command, options);
  }

  // Runs a command, throwing when it exits with an error.
  async run(command, options) {
    const result = await this.exec(command, options);
    if (result.code !== 0) throw new Error(`The router refused a command (exit ${result.code}).`);
    return result.stdout;
  }

  async nvram(options) {
    return this.cache.get(options);
  }

  invalidate() {
    this.cache.invalidate();
  }

  async info(options) {
    const values = await this.nvram(options);
    if (this.detectedFor !== values) {
      this.detected = await detect(values, (command) => this.exec(command));
      this.detectedFor = values;
    }
    return this.detected;
  }

  async catalog(options) {
    return buildCatalog(await this.info(options));
  }

  async context(options) {
    const [info, nvram] = [await this.info(options), await this.nvram()];
    return { session: this, exec: (c, o) => this.exec(c, o), nvram, info, catalog: buildCatalog(info) };
  }

  // A brand-new connection that does not share anything with the main one.
  async openFresh(overrides = {}) {
    const connection = new RouterConnection({ ...this.connectionOptions(undefined, overrides), readyTimeoutMs: this.verifyTimeoutMs });
    await connection.connect();
    return connection;
  }

  async reconnect() {
    this.close();
    this.invalidate();
    return this.ensure();
  }

  close() {
    this.connection?.close();
    this.connection = null;
  }
}
