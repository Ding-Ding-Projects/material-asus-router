// The household screen, the parts that need no browser: the weekly painting
// grid and how it turns into time blocks and back, the allowance wording, the
// presence wording, and the ranking of who is uploading or downloading most.

export const DAYS = [
  { id: 0, en: "Sun", yue: "日" }, { id: 1, en: "Mon", yue: "一" }, { id: 2, en: "Tue", yue: "二" }, { id: 3, en: "Wed", yue: "三" },
  { id: 4, en: "Thu", yue: "四" }, { id: 5, en: "Fri", yue: "五" }, { id: 6, en: "Sat", yue: "六" },
];
export const KINDS = {
  work: { icon: "work", en: "At work", yue: "返工", tone: "tertiary" },
  sleep: { icon: "bedtime", en: "Sleeping", yue: "瞓覺", tone: "primary" },
  home: { icon: "home", en: "At home", yue: "喺屋企", tone: "good" },
};
export const BRUSHES = ["work", "sleep", "home", "erase"];

const pad = (n) => String(n).padStart(2, "0");
export const hourText = (h) => `${pad(h % 24)}:00`;
const hourOf = (text) => Number(String(text).slice(0, 2));

// A grid is 7 rows of 24 cells; a cell is a kind or null.
export const emptyGrid = () => Array.from({ length: 7 }, () => Array(24).fill(null));

export function gridFromBlocks(blocks = []) {
  const grid = emptyGrid();
  for (const b of blocks) {
    const from = hourOf(b.from);
    const to = hourOf(b.to);
    const overnight = to <= from;
    for (const day of b.days ?? []) {
      if (!overnight) for (let h = from; h < to; h += 1) grid[day][h] = b.kind;
      else {
        for (let h = from; h < 24; h += 1) grid[day][h] = b.kind;
        const next = (day + 1) % 7;
        for (let h = 0; h < to; h += 1) grid[next][h] = b.kind;
      }
    }
  }
  return grid;
}

// Runs of the same kind in a day become blocks; identical blocks on several days are joined.
export function blocksFromGrid(grid, allowances = {}) {
  const runs = new Map();
  for (let d = 0; d < 7; d += 1) {
    let h = 0;
    while (h < 24) {
      const kind = grid[d][h];
      if (!kind) { h += 1; continue; }
      let end = h;
      while (end < 24 && grid[d][end] === kind) end += 1;
      const key = `${kind}|${h}|${end}`;
      if (!runs.has(key)) runs.set(key, { kind, from: hourText(h), to: hourText(end), days: [] });
      runs.get(key).days.push(d);
      h = end;
    }
  }
  return [...runs.values()].map((b, i) => ({ id: `g${i}`, ...b, allowance: allowances[b.kind] ?? null }));
}

// Paints a rectangle of cells between two corners.
export function paintRect(grid, a, b, brush) {
  const next = grid.map((row) => row.slice());
  const [d0, d1] = [Math.min(a.day, b.day), Math.max(a.day, b.day)];
  const [h0, h1] = [Math.min(a.hour, b.hour), Math.max(a.hour, b.hour)];
  for (let d = d0; d <= d1; d += 1) for (let h = h0; h <= h1; h += 1) next[d][h] = brush === "erase" ? null : brush;
  return next;
}

export const countCells = (grid) => grid.flat().filter(Boolean).length;
export function gridSummary(grid) {
  const out = { work: 0, sleep: 0, home: 0 };
  for (const cell of grid.flat()) if (cell) out[cell] += 1;
  return out;
}

// ---- wording ------------------------------------------------------------------------

export const LEVEL_WORDS = [
  { en: "0 · Nothing at all", yue: "0 · 完全唔可以" },
  { en: "1 · A small blip", yue: "1 · 輕微中斷" },
  { en: "2 · Wi-Fi drops", yue: "2 · Wi-Fi 會斷" },
  { en: "3 · Anything", yue: "3 · 乜都得" },
];

export function presenceText(member) {
  const wifi = (member.sources ?? []).find((s) => s.source === "wifi");
  const ha = (member.sources ?? []).find((s) => s.source === "homeAssistant");
  const name = { en: member.name, yue: member.nameYue || member.name };
  if (!member.configured) return { tone: "unknown", en: `${name.en}: no devices or entities picked yet.`, yue: `${name.yue}：仲未揀裝置或者實體。` };
  const parts = [];
  const partsYue = [];
  if (wifi) {
    if (wifi.state === "home") { const labels = (wifi.devices ?? []).map((d) => `${d.label} (${d.network})`).join(", "); parts.push(`on Wi-Fi: ${labels}`); partsYue.push(`連住 Wi-Fi：${labels}`); }
    else if (wifi.state === "away") { parts.push("no device on the home Wi-Fi"); partsYue.push("冇裝置連住屋企 Wi-Fi"); }
    else { parts.push("Wi-Fi could not be read"); partsYue.push("讀唔到 Wi-Fi"); }
  }
  if (ha) { parts.push(`Home Assistant says ${ha.state}`); partsYue.push(`Home Assistant 話${ha.state === "home" ? "喺屋企" : ha.state === "away" ? "唔喺屋企" : "唔知"}`); }
  const state = member.state;
  const word = { home: ["is home", "喺屋企"], away: ["is away", "唔喺屋企"], unknown: ["may be home (cannot tell)", "可能喺屋企（睇唔到）"] }[state] ?? ["may be home", "可能喺屋企"];
  return { tone: state, en: `${name.en} ${word[0]} · ${parts.join("; ")}`, yue: `${name.yue}${word[1]} · ${partsYue.join("；")}` };
}

// A wired-only person cannot be seen by Wi-Fi, so say so instead of guessing.
export const wiredOnlyNote = (member, devices) => {
  const macs = new Set((member.devices ?? []).map((d) => d.mac));
  const picked = devices.filter((d) => macs.has(d.mac));
  return picked.length > 0 && picked.every((d) => !d.wireless);
};

// ---- who is using the most -----------------------------------------------------------------

export const METRICS = {
  down: { en: "Downloading now", yue: "而家下載", field: "down", total: false },
  up: { en: "Uploading now", yue: "而家上傳", field: "up", total: false },
  totalDown: { en: "Downloaded in total", yue: "累計下載", field: "totalDown", total: true },
  totalUp: { en: "Uploaded in total", yue: "累計上傳", field: "totalUp", total: true },
};

// Averages the last few readings per device so one busy second does not decide the ranking.
export function recentAverage(history = [], span = 20) {
  const slice = history.slice(-span);
  const sums = new Map();
  for (const point of slice) for (const [ip, v] of Object.entries(point.devices ?? {})) {
    const s = sums.get(ip) ?? { up: 0, down: 0, n: 0 };
    s.up += v.up; s.down += v.down; s.n += 1;
    sums.set(ip, s);
  }
  const out = new Map();
  for (const [ip, s] of sums) out.set(ip, { up: s.up / slice.length, down: s.down / slice.length });
  return out;
}

// Ranks devices by a metric. `members` are the household's people, so a device owned by a person is
// labelled with them. Devices with nothing moving are left out unless `idle` is true.
export function rankTalkers(view, members = [], metric = "down", { idle = false, average = false, limit = 12 } = {}) {
  const m = METRICS[metric] ?? METRICS.down;
  const owners = new Map();
  for (const member of members) for (const d of member.devices ?? []) owners.set(String(d.mac).toUpperCase(), member);
  const avg = average ? recentAverage(view.history) : null;
  const rows = (view.devices ?? []).map((d) => {
    const owner = d.mac ? owners.get(String(d.mac).toUpperCase()) : null;
    const rate = avg?.get(d.ip);
    const value = !m.total && rate ? rate[m.field] : d[m.field];
    return { ip: d.ip, mac: d.mac, name: d.name, owner: owner ? { id: owner.id, name: owner.name, nameYue: owner.nameYue || owner.name } : null, value: Number(value) || 0, up: d.up, down: d.down, totalUp: d.totalUp, totalDown: d.totalDown, flows: d.flows };
  });
  const shown = rows.filter((r) => idle || r.value > 0).sort((a, b) => b.value - a.value || a.ip.localeCompare(b.ip, undefined, { numeric: true })).slice(0, limit);
  const top = shown[0]?.value ?? 0;
  const sum = rows.reduce((s, r) => s + r.value, 0);
  return shown.map((r, i) => ({ ...r, rank: i + 1, share: sum ? r.value / sum : 0, ratio: top ? r.value / top : 0 }));
}

// Totals per person: devices nobody owns are grouped as "Other devices".
export function rankPeople(view, members = [], metric = "down") {
  const rows = rankTalkers(view, members, metric, { idle: true, limit: 1000 });
  const groups = new Map();
  for (const r of rows) {
    const key = r.owner?.id ?? "other";
    const g = groups.get(key) ?? { id: key, name: r.owner?.name ?? "Other devices", nameYue: r.owner?.nameYue ?? "其他裝置", value: 0, devices: 0 };
    g.value += r.value;
    g.devices += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.value - a.value);
}

export const rateText = (value, metric, unit = "bits") => {
  const total = METRICS[metric]?.total;
  if (total) return value >= 1e9 ? `${(value / 1e9).toFixed(2)} GB` : value >= 1e6 ? `${(value / 1e6).toFixed(1)} MB` : `${Math.round(value / 1e3)} kB`;
  const v = unit === "bytes" ? value / 1e6 : (value * 8) / 1e6;
  const shown = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return `${shown} ${unit === "bytes" ? "MB/s" : "Mbit/s"}`;
};
