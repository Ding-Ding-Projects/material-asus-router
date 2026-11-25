// Reads the router's settings once, remembers them briefly and works out what
// kind of router this is. Every other module asks this cache instead of
// running `nvram show` again, and writes invalidate it.

export function parseNvram(text) {
  const values = new Map();
  for (const line of String(text).split("\n")) {
    const at = line.indexOf("=");
    if (at < 1) continue;
    values.set(line.slice(0, at), line.slice(at + 1));
  }
  return values;
}

export class NvramCache {
  constructor(exec, { ttlMs = 5000, now = Date.now } = {}) {
    this.exec = exec;
    this.ttlMs = ttlMs;
    this.now = now;
    this.values = null;
    this.at = 0;
    this.pending = null;
  }

  invalidate() {
    this.values = null;
    this.at = 0;
  }

  get fresh() {
    return Boolean(this.values) && this.now() - this.at < this.ttlMs;
  }

  // Returns a Map of every setting. Pass fresh: true to bypass the cache.
  async get({ fresh = false } = {}) {
    if (!fresh && this.fresh) return this.values;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const result = await this.exec("nvram show");
        if (result.code !== 0 && !result.stdout) throw new Error("The router did not return its settings.");
        this.values = parseNvram(result.stdout);
        this.at = this.now();
        return this.values;
      } finally {
        this.pending = null;
      }
    })();
    return this.pending;
  }
}

// Works out the model, firmware, bands and capabilities from the settings.
export async function detect(values, exec) {
  const get = (key) => values.get(key) ?? "";
  let merlin = get("3rd-party") === "merlin";
  if (!merlin && exec) {
    try {
      merlin = (await exec("test -f /usr/sbin/helper.sh && echo yes || echo no")).stdout.trim() === "yes";
    } catch {
      merlin = false;
    }
  }
  const names = get("wl_ifnames").split(/\s+/).filter(Boolean);
  const indices = new Set();
  for (const key of values.keys()) {
    const m = key.match(/^wl(\d+)_nband$/);
    if (m) indices.add(Number(m[1]));
  }
  names.forEach((_, i) => indices.add(i));
  const bands = [...indices]
    .sort((a, b) => a - b)
    .filter((i) => get(`wl${i}_nband`) !== "" || names[i])
    .map((index) => ({
      index,
      nband: get(`wl${index}_nband`) || (index === 0 ? "2" : "1"),
      ifname: get(`wl${index}_ifname`) || names[index] || `wl${index}`,
    }));
  const buildno = get("buildno");
  const extendno = get("extendno");
  return {
    model: get("productid") || get("odmpid") || "Unknown model",
    firmware: [get("firmver"), buildno && `.${buildno}`, extendno && `_${extendno}`].filter(Boolean).join("") || "unknown",
    merlin,
    bands,
    capabilities: get("rc_support").split(/\s+/).filter(Boolean),
    lan: { ip: get("lan_ipaddr"), mask: get("lan_netmask") },
  };
}
