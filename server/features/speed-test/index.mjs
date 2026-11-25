// Speed test: measures real throughput from the router itself with curl, so the
// number is what the router's internet link delivers, not what a phone on weak
// Wi-Fi sees. The test server is the person's choice (a saved preference of this app). A
// run is a handful of chunks so the browser can show a live gauge; the server
// keeps the run, adds up the chunks and saves the finished result in history.
import { L, ON_OFF, appPrefs, hostTarget } from "../kit.mjs";
import { featureState } from "./state.mjs";

const SIZES = [[10, "10 MB"], [25, "25 MB"], [100, "100 MB"]];
const STYLES = ["bytes", "file"];
const store = featureState("speed-test", { history: [] });
const runs = new Map(); // run id -> { settings, down, up, stage }
let nextRun = 1;
const HISTORY_LIMIT = 100;

// The test server settings are this app's own preferences (see "prefs" below), never router settings.
const settingsOf = (prefs) => {
  const get = (k, d) => prefs.get(k) || d;
  const size = Number(get("size", "25"));
  const style = get("style", "bytes");
  return {
    host: prefs.get("host") ?? "",
    scheme: get("scheme", "https") === "http" ? "http" : "https",
    style: STYLES.includes(style) ? style : "bytes",
    mb: SIZES.some(([n]) => n === size) ? size : 25,
    upload: get("upload", "1") === "1",
    chunks: Math.min(12, Math.max(3, Number(get("chunks", "6")) || 6)),
  };
};

// "bytes" style (/__down?bytes=N and /__up) is what common speed services answer; "file" style fetches /<N>MB.bin.
const downloadUrl = (s, bytes) => `${s.scheme}://${hostTarget(s.host)}${s.style === "bytes" ? `/__down?bytes=${bytes}` : `/${Math.max(1, Math.round(bytes / 1e6))}MB.bin`}`;
const uploadUrl = (s) => `${s.scheme}://${hostTarget(s.host)}/__up`;
const DOWN_FORMAT = "%{speed_download} %{time_total} %{size_download} %{time_connect}";
const UP_FORMAT = "%{speed_upload} %{time_total} %{size_upload} %{time_connect}";

function parseResult(out, direction) {
  const [speed, seconds, size, connect] = out.stdout.trim().split(/\s+/).map(Number);
  if (out.code !== 0 || !Number.isFinite(speed) || !(seconds > 0)) return null;
  return { direction, mbit: (speed * 8) / 1e6, seconds, bytes: Math.round(size), connectMs: Math.round(connect * 1000) };
}

async function measure(exec, s, direction, bytes) {
  const url = direction === "down" ? downloadUrl(s, bytes) : uploadUrl(s);
  const command =
    direction === "down"
      ? `curl -s -o /dev/null -w '${DOWN_FORMAT}' --max-time 40 '${url}'`
      : `head -c ${bytes} /dev/zero | curl -s -o /dev/null -w '${UP_FORMAT}' --max-time 40 -X POST --data-binary @- '${url}'`;
  const out = await exec(command, { timeoutMs: 60000 });
  const parsed = parseResult(out, direction);
  if (!parsed) throw Object.assign(new Error(`The test server did not answer (${out.stderr.trim().split("\n")[0] || `curl exit code ${out.code}`}).`), { status: 502 });
  return parsed;
}

const average = (samples) => {
  const bytes = samples.reduce((n, x) => n + x.bytes, 0);
  const seconds = samples.reduce((n, x) => n + x.seconds, 0);
  return seconds ? (bytes * 8) / seconds / 1e6 : 0;
};

const DEFAULTS = { host: "", scheme: "https", style: "bytes", size: "25", chunks: "6", upload: "1" };

const g = { domain: "speed-test", group: "server", groupLabel: L("Test server", "測試伺服器"), risk: "low" };
const prefs = appPrefs("speed-test", [
  { ...g, id: "speed-test.host", key: "host", default: DEFAULTS.host, control: "hostname", optional: true,
    label: L("Test server", "測試伺服器"), help: L("The host name of the server the router downloads from. Pick a server near you that allows speed tests; none is built in.", "路由器由邊個伺服器下載。揀一個近你、容許測速嘅伺服器；本程式冇內置。") },
  { ...g, id: "speed-test.scheme", key: "scheme", default: DEFAULTS.scheme, control: "segmented", options: [["https", L("HTTPS", "HTTPS"), L("Encrypted. Recommended.", "有加密，建議用。")], ["http", L("HTTP", "HTTP"), L("Plain, for servers without HTTPS.", "冇加密，俾唔支援 HTTPS 嘅伺服器。")]],
    label: L("Connection type", "連線類型"), help: L("HTTPS is slower on small routers but safer.", "細部路由器用 HTTPS 會慢啲，但更安全。") },
  { ...g, id: "speed-test.style", key: "style", default: DEFAULTS.style, control: "select", options: [["bytes", L("Size in the address", "地址帶大小"), L("/__down?bytes=N and /__up, like common speed services.", "好似常見測速服務：/__down?bytes=N 同 /__up。")], ["file", L("Fixed files", "固定檔案"), L("Downloads /<N>MB.bin from the server.", "由伺服器下載 /<N>MB.bin。")]],
    label: L("How the server hands out test data", "伺服器點樣提供測試資料"), help: L("Pick the style your test server uses.", "揀你嘅測試伺服器用嘅方式。") },
  { ...g, id: "speed-test.size", key: "size", default: DEFAULTS.size, control: "select", options: SIZES.map(([n, label]) => [String(n), L(label, label)]),
    label: L("Data per test", "每次測試資料量"), help: L("More data gives a steadier number but uses more of your allowance.", "資料愈多，數字愈穩定，但會用多啲流量。") },
  { ...g, id: "speed-test.chunks", key: "chunks", default: DEFAULTS.chunks, control: "stepper", min: 3, max: 12, unit: "steps",
    label: L("Steps per test", "每次測試步數"), help: L("The test runs in this many steps so the gauge can move while it works.", "測試分咗呢個數量嘅步驟，儀表先可以邊做邊郁。") },
  { ...g, id: "speed-test.upload", key: "upload", default: DEFAULTS.upload, control: "switch", values: ON_OFF,
    label: L("Also test upload", "同時測試上傳"), help: L("Sends the same amount of data to the server after the download.", "下載完之後，用同樣份量嘅資料上傳。") },
]);

export default {
  id: "speed-test",

  domainMeta: [{ id: "speed-test", icon: "speed", label: L("Speed test", "測速"), group: { en: "Monitor", yue: "監察" } }],
  domains: {
    "speed-test": async () => {
      const saved = await prefs.read();
      const s = settingsOf(saved);
      const { history } = await store.read();
      return { ...s, configured: Boolean(s.host), history: history.slice(-HISTORY_LIMIT), entries: prefs.entries(saved) };
    },
  },

  routes(api) {
    prefs.routes(api);
    api.get("/history", async () => ({ history: (await store.read()).history }));
    api.delete("/history", async () => {
      await store.update((s) => void (s.history = []));
      return { ok: true };
    });
    // Starts a run: the browser then asks for one step at a time.
    api.post("/runs", async ({ bad }) => {
      const s = settingsOf(await prefs.read());
      if (!s.host) throw bad("Choose a test server in the settings first.", 409);
      const id = String(nextRun++);
      runs.set(id, { settings: s, down: [], up: [], stage: "down" });
      if (runs.size > 20) runs.delete(runs.keys().next().value);
      return { id, steps: s.chunks, upload: s.upload, host: s.host };
    });
    api.post("/runs/:id/step", async ({ live, params, bad }) => {
      const run = runs.get(params.id);
      if (!run) throw bad("That test is not running any more.", 404);
      const ctx = await live();
      const s = run.settings;
      const bytes = Math.round((s.mb * 1e6) / s.chunks);
      const direction = run.stage;
      const sample = await measure(ctx.exec, s, direction, bytes);
      run[direction].push(sample);
      const list = run[direction];
      const result = { sample, direction, step: list.length, steps: s.chunks, runningMbit: average(list) };
      if (list.length >= s.chunks) run.stage = direction === "down" && s.upload ? "up" : "done";
      if (run.stage === "done") {
        const entry = {
          at: new Date().toISOString(),
          host: s.host,
          mb: s.mb,
          down: Math.round(average(run.down) * 10) / 10,
          up: run.up.length ? Math.round(average(run.up) * 10) / 10 : null,
          connectMs: Math.round(run.down.reduce((n, x) => n + x.connectMs, 0) / run.down.length),
        };
        await store.update((st) => {
          st.history.push(entry);
          while (st.history.length > HISTORY_LIMIT) st.history.shift();
        });
        runs.delete(params.id);
        result.finished = entry;
      } else result.next = run.stage;
      return result;
    });
  },

  fakeRouter: {
    handlers: [
      (command) => {
        const down = command.match(/^curl -s -o \/dev\/null -w '[^']*' --max-time 40 '(https?):\/\/([^/']+)\/(?:__down\?bytes=(\d+)|(\d+)MB\.bin)'$/);
        const up = command.match(/^head -c (\d+) \/dev\/zero \| curl -s -o \/dev\/null -w '[^']*' --max-time 40 -X POST --data-binary @- '(https?):\/\/([^/']+)\/__up'$/);
        if (!down && !up) return undefined;
        const host = down ? down[2] : up[3];
        if (host.endsWith(".invalid")) return { code: 6, stderr: "curl: (6) Could not resolve host\n" };
        const bytes = down ? Number(down[3] ?? Number(down[4]) * 1e6) : Number(up[1]);
        const rate = down ? 11_250_000 : 3_000_000; // bytes per second: 90 and 24 megabits
        return { stdout: `${rate} ${(bytes / rate).toFixed(3)} ${bytes} 0.021\n` };
      },
    ],
  },
};
