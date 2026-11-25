// One SSH connection to the router. The router's host key must be approved
// once by the owner; after that any different key is refused, which stops a
// look-alike device on the network from receiving the router password.
// Commands run one at a time because many routers allow few SSH channels.
import { createHash } from "node:crypto";
import { Client } from "ssh2";

export class HostKeyError extends Error {
  constructor(fingerprint, pinned) {
    super(pinned ? "The router presented a different host key than the one you approved." : "Approve the router's host key to continue.");
    this.code = pinned ? "HOST_KEY_CHANGED" : "HOST_KEY_UNKNOWN";
    this.fingerprint = fingerprint;
  }
}

export const fingerprint = (key) => `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;

export class RouterConnection {
  constructor({ host, port = 22, username, password, privateKey, hostKey, readyTimeoutMs = 10000 }) {
    this.options = { host, port, username, password, privateKey, hostKey, readyTimeoutMs };
    this.client = null;
    this.queue = Promise.resolve();
    this.seenFingerprint = null;
  }

  connect() {
    const { host, port, username, password, privateKey, hostKey, readyTimeoutMs } = this.options;
    return new Promise((resolve, reject) => {
      const client = new Client();
      let settled = false;
      const done = (error) => {
        if (settled) return;
        settled = true;
        if (error) {
          client.end();
          reject(error);
        } else {
          this.client = client;
          resolve(this);
        }
      };
      client.on("ready", () => done());
      client.on("error", (error) => {
        if (this.hostKeyError) return done(this.hostKeyError);
        const friendly = new Error(
          error.level === "client-authentication"
            ? "The router refused the user name, password or key."
            : `Could not reach the router: ${error.message}`,
        );
        friendly.code = error.level === "client-authentication" ? "AUTH_FAILED" : "UNREACHABLE";
        done(friendly);
      });
      client.on("close", () => {
        if (this.client === client) this.client = null;
        if (!settled) done(this.hostKeyError ?? Object.assign(new Error("Could not reach the router: the connection closed."), { code: "UNREACHABLE" }));
      });
      client.connect({
        host,
        port,
        username,
        password: privateKey ? undefined : password,
        privateKey: privateKey || undefined,
        readyTimeout: readyTimeoutMs,
        keepaliveInterval: 15000,
        tryKeyboard: false,
        hostVerifier: (key) => {
          const seen = fingerprint(key);
          this.seenFingerprint = seen;
          if (hostKey && hostKey === seen) return true;
          this.hostKeyError = new HostKeyError(seen, Boolean(hostKey));
          return false;
        },
      });
    });
  }

  get connected() {
    return Boolean(this.client);
  }

  exec(command, { timeoutMs = 20000 } = {}) {
    const run = this.queue.then(() => this.#run(command, timeoutMs));
    this.queue = run.catch(() => {});
    return run;
  }

  #run(command, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(Object.assign(new Error("Not connected to the router."), { code: "UNREACHABLE" }));
      this.client.exec(command, (error, stream) => {
        if (error) return reject(error);
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          stream.close();
          reject(Object.assign(new Error("The router took too long to answer."), { code: "TIMEOUT" }));
        }, timeoutMs);
        stream.on("data", (chunk) => {
          stdout += chunk;
          if (stdout.length > 8 * 1024 * 1024) stream.close();
        });
        stream.stderr.on("data", (chunk) => (stderr += chunk));
        stream.on("close", (code) => {
          clearTimeout(timer);
          resolve({ code: code ?? 0, stdout, stderr });
        });
      });
    });
  }

  close() {
    this.client?.end();
    this.client = null;
  }
}
