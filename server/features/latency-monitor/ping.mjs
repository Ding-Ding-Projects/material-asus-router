// Reads `ping` output and turns a run of samples into the numbers the screen
// shows. Pure functions, no router access.

// "3 packets transmitted, 2 packets received, 33% packet loss" plus "time=12.3 ms" lines.
export function parsePing(text, { code = 0 } = {}) {
  const stats = String(text).match(/(\d+) packets transmitted, (\d+) (?:packets )?received/);
  const times = [...String(text).matchAll(/time=([\d.]+)\s*ms/g)].map((m) => Number(m[1]));
  const sent = stats ? Number(stats[1]) : 0;
  const got = stats ? Number(stats[2]) : times.length;
  if (!sent) return { sent: 0, got: 0, loss: 100, min: null, avg: null, max: null, error: code !== 0 ? "The router could not run ping." : "No reply statistics." };
  const loss = Math.round(((sent - got) / sent) * 100);
  return { sent, got, loss, min: times.length ? Math.min(...times) : null, avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null, max: times.length ? Math.max(...times) : null, error: null };
}

const round = (n) => (n === null ? null : Math.round(n * 10) / 10);

// Loss, latency and jitter over a list of samples ({ loss, avg, min, max }).
export function summarise(samples) {
  if (!samples.length) return { count: 0, loss: null, avg: null, min: null, max: null, jitter: null, last: null };
  const answered = samples.filter((s) => s.avg !== null);
  const avgs = answered.map((s) => s.avg);
  let jitter = null;
  if (avgs.length > 1) jitter = avgs.slice(1).reduce((sum, v, i) => sum + Math.abs(v - avgs[i]), 0) / (avgs.length - 1);
  return {
    count: samples.length,
    loss: round(samples.reduce((n, s) => n + s.loss, 0) / samples.length),
    avg: round(avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null),
    min: round(answered.length ? Math.min(...answered.map((s) => s.min)) : null),
    max: round(answered.length ? Math.max(...answered.map((s) => s.max)) : null),
    jitter: round(jitter),
    last: samples.at(-1),
  };
}

// Alert rules. A target is "bad" when a sample loses too many packets or answers too slowly; an alert
// is raised after two bad samples in a row (one blip is not an outage) and a recovery after two good ones.
export function judge(sample, { lossAlertPct, latencyAlertMs }) {
  if (sample.loss >= lossAlertPct) return sample.loss >= 100 ? "down" : "lossy";
  if (sample.avg !== null && sample.avg > latencyAlertMs) return "slow";
  return null;
}

export function nextAlert(track, verdict) {
  const next = { ...track };
  if (verdict) {
    next.bad = (track.bad ?? 0) + 1;
    next.good = 0;
    if (next.bad >= 2 && !track.active) {
      next.active = verdict;
      return { track: next, event: { kind: verdict, level: "bad" } };
    }
  } else {
    next.good = (track.good ?? 0) + 1;
    next.bad = 0;
    if (next.good >= 2 && track.active) {
      next.active = null;
      return { track: next, event: { kind: "recovered", level: "good" } };
    }
  }
  return { track: next, event: null };
}
