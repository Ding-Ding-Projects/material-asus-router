// Runs one extension as a separate process and answers its requests. The
// protocol is JSON lines over standard input and output, so an extension can
// be written in any language:
//   host -> extension   {"hello":{"api":1,"permissions":["router.status"]}}
//   extension -> host   {"id":1,"call":"router.uptime"}
//   host -> extension   {"id":1,"ok":true,"value":{"seconds":12345}}
//   extension -> host   {"result":{...}}   (once, then it exits)
// The host enforces the granted permissions on every call, a size limit on
// the output and a time limit on the whole run.
import path from "node:path";
import { SENSITIVE_KEY } from "./manifest.mjs";

// The process module is fetched with the official built-in loader (Node 22.3 and
// later) so the feature folder keeps importing only the kit and its own files.
const { spawn } = process.getBuiltinModule("node:child_process");

export const LIMITS = { timeoutMs: 5000, maxBytes: 65536, maxCalls: 20 };

export async function runExtension({ manifest, dir, granted, exec, nvram, limits = LIMITS }) {
  const file = path.join(dir, manifest.entry);
  const child = spawn(process.execPath, [file], { stdio: ["pipe", "pipe", "ignore"], env: {}, windowsHide: true });
  return new Promise((resolve) => {
    let buffer = "";
    let bytes = 0;
    let calls = 0;
    let done = false;
    let timer = null;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      resolve(value);
    };
    timer = setTimeout(() => finish({ ok: false, error: `The extension took longer than ${limits.timeoutMs} ms and was stopped.` }), limits.timeoutMs);
    const send = (message) => {
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      } catch {}
    };
    const answer = async (msg) => {
      calls += 1;
      if (calls > limits.maxCalls) return send({ id: msg.id, ok: false, error: "too-many-calls" });
      try {
        if (msg.call === "router.uptime") {
          if (!granted.includes("router.status")) return send({ id: msg.id, ok: false, error: "permission-denied" });
          const out = await exec("head -n 100000 /proc/uptime");
          return send({ id: msg.id, ok: true, value: { seconds: Math.floor(Number(String(out.stdout).split(" ")[0])) || 0 } });
        }
        if (msg.call === "nvram.get") {
          if (!granted.includes("nvram.read")) return send({ id: msg.id, ok: false, error: "permission-denied" });
          const key = String(msg.key ?? "");
          if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(key) || SENSITIVE_KEY.test(key)) return send({ id: msg.id, ok: false, error: "key-not-available" });
          return send({ id: msg.id, ok: true, value: nvram.get(key) ?? "" });
        }
        return send({ id: msg.id, ok: false, error: "unknown-call" });
      } catch {
        return send({ id: msg.id, ok: false, error: "failed" });
      }
    };
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > limits.maxBytes) return finish({ ok: false, error: `The extension wrote more than ${limits.maxBytes} bytes and was stopped.` });
      buffer += chunk.toString("utf8");
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return finish({ ok: false, error: "The extension sent something that is not JSON." });
        }
        if (msg && "result" in msg) return finish({ ok: true, result: msg.result });
        if (msg && msg.call) answer(msg);
      }
    });
    child.on("error", (e) => finish({ ok: false, error: `The extension could not start: ${e.message}` }));
    child.on("exit", () => setTimeout(() => finish({ ok: false, error: "The extension ended without a result." }), 20));
    send({ hello: { api: 1, permissions: granted } });
  });
}
