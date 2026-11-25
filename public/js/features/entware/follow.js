// Follows one running job: asks the server for "everything after piece N" and
// is answered as soon as there is news (long polling), so output shows up as
// fast as the router prints it. It keeps going until the job is really
// finished, and keeps trying if the link to this app blips. It imports
// nothing, so Node tests can run it against a fake api.

export const FINAL = new Set(["done", "failed", "reverted", "unreachable"]);

export function followJob({ api, base, id, onChunks, onState, wait = 8000, retryMs = 1200, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let stopped = false;
  const done = (async () => {
    let from = 0;
    let failures = 0;
    for (;;) {
      if (stopped) return null;
      let r;
      try {
        r = await api.get(`${base}/jobs/${id}?from=${from}&wait=${wait}`);
        failures = 0;
      } catch (error) {
        if (stopped) return null;
        failures += 1;
        onState?.({ status: "waiting", error, failures });
        if (error.status === 404 || failures > 60) return { status: "lost", error };
        await sleep(retryMs);
        continue;
      }
      from = r.next;
      if (r.chunks.length) onChunks?.(r.chunks, r);
      onState?.(r);
      if (FINAL.has(r.status)) return r;
    }
  })();
  return { done, stop: () => (stopped = true) };
}

// How a job's end is said in words.
export const ENDING = {
  running: { icon: "sync", tone: "", en: "Running", yue: "運行緊" },
  waiting: { icon: "hourglass_top", tone: "warn", en: "Waiting for the app to reach the router", yue: "等緊程式連到路由器" },
  done: { icon: "check_circle", tone: "good", en: "Finished", yue: "完成" },
  failed: { icon: "error", tone: "bad", en: "The router reported a problem", yue: "路由器報告有問題" },
  reverted: { icon: "history", tone: "warn", en: "The safety net put things back", yue: "安全機制已還原" },
  unreachable: { icon: "wifi_off", tone: "bad", en: "The router did not answer in time", yue: "路由器未能及時回應" },
  lost: { icon: "help", tone: "warn", en: "This job is no longer known to the app", yue: "程式已經唔記得呢個工作" },
};
