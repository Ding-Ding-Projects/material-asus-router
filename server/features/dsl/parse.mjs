// Reads the output of `xdslctl info --show` (the Broadcom DSL driver the
// ASUS DSL routers use) into plain numbers. Read only: nothing here writes.

const num = (text) => {
  const n = Number(String(text).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const STATES = new Map([
  ["showtime", "up"],
  ["idle", "down"],
  ["handshake", "training"],
  ["g.994 training", "training"],
  ["g.992 started", "training"],
  ["g.992 channel analysis", "training"],
  ["g.992 message exchange", "training"],
  ["g.993 started", "training"],
  ["g.993 channel analysis", "training"],
  ["g.993 message exchange", "training"],
  ["initializing", "training"],
]);

export function parseXdsl(text) {
  const out = { state: "unknown", status: "", mode: "", modulation: "", annex: "", rate: { down: null, up: null }, maxRate: { down: null, up: null }, snr: { down: null, up: null }, attenuation: { down: null, up: null }, power: { down: null, up: null }, lineStatus: "", retrainReason: null };
  const lines = String(text ?? "").split(/\r?\n/);
  const pair = (line) => {
    const m = line.match(/:\s*(-?[\d.]+)\s+(-?[\d.]+)\s*$/);
    return m ? { down: num(m[1]), up: num(m[2]) } : null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^Status:\s*(.+)$/i))) out.status = m[1].trim();
    else if ((m = line.match(/^Last Retrain Reason:\s*(\d+)/i))) out.retrainReason = num(m[1]);
    else if ((m = line.match(/^Max:.*Upstream rate\s*=\s*(\d+)\s*Kbps,\s*Downstream rate\s*=\s*(\d+)\s*Kbps/i))) out.maxRate = { up: num(m[1]), down: num(m[2]) };
    else if ((m = line.match(/^Bearer:.*Upstream rate\s*=\s*(\d+)\s*Kbps,\s*Downstream rate\s*=\s*(\d+)\s*Kbps/i))) out.rate = { up: num(m[1]), down: num(m[2]) };
    else if ((m = line.match(/^Mode:\s*(.+)$/i))) {
      out.mode = m[1].trim();
      const mm = out.mode.match(/^(.*?)\s+(Annex\s+\S+)/i);
      out.modulation = (mm ? mm[1] : out.mode).trim();
      out.annex = mm ? mm[2].toUpperCase() : "";
    } else if ((m = line.match(/^Line Status:\s*(.+)$/i))) out.lineStatus = m[1].trim();
    else if ((m = line.match(/^Training Status:\s*(.+)$/i))) out.trainingStatus = m[1].trim();
    else if (/^SNR \(dB\)/i.test(line)) out.snr = pair(line) ?? out.snr;
    else if (/^Attn\(dB\)/i.test(line)) out.attenuation = pair(line) ?? out.attenuation;
    else if (/^Pwr\(dBm\)/i.test(line)) out.power = pair(line) ?? out.power;
  }
  const key = (out.trainingStatus || out.status).toLowerCase();
  out.state = STATES.get(key) ?? (key ? "training" : "unknown");
  return out;
}

// A plain verdict a person can act on, from the SNR margin and the line loss.
export function verdict(info) {
  if (info.state !== "up") return { level: info.state === "training" ? "wait" : "bad", id: info.state === "training" ? "training" : "down" };
  const snr = info.snr?.down;
  const attn = info.attenuation?.down;
  if (snr === null || snr === undefined) return { level: "wait", id: "unknown" };
  if (snr < 6) return { level: "bad", id: "snr-low" };
  if (snr < 9 || (attn ?? 0) > 50) return { level: "warn", id: "snr-ok" };
  return { level: "good", id: "strong" };
}
