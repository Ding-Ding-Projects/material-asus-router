// Export everything, in every format that can carry it. Four kinds of record
// (router settings, devices, change history and router logs) can be exported
// as JSON, CSV, YAML, Markdown, HTML or PDF, or bundled in one ZIP archive.
// Secrets are always masked and the response counts how many were omitted.
// Before exporting, /formats says exactly what each format loses; JSON, CSV
// and YAML can be read back through /parse.
import { FORMATS, LOSS, SCHEMA_VERSION, describe, parse, pdfFile, serialize, tableLines, zipFile } from "./formats.mjs";

const ID = "exports";
const SECRET_KEY = /psk|passw|authkey|secret|token|key/i;
const KINDS = {
  settings: { en: "Router settings", yue: "路由器設定" },
  devices: { en: "Devices", yue: "裝置" },
  history: { en: "Change history", yue: "改動記錄" },
  logs: { en: "Router log", yue: "路由器日誌" },
};
const MASKED = "(hidden)";

async function collect(kind, { live, app }) {
  if (kind === "settings") {
    const ctx = await live();
    const byKey = new Map(ctx.catalog.map((e) => [e.key, e]));
    let hidden = 0;
    const rows = [...ctx.nvram.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
      const secret = SECRET_KEY.test(key) || Boolean(byKey.get(key)?.secret);
      if (secret && value !== "") hidden++;
      return { key, value: secret && value !== "" ? MASKED : value, setting: byKey.get(key)?.label?.en ?? "" };
    });
    return { title: "Router settings", columns: ["key", "value", "setting"], rows, hidden, model: ctx.info.model };
  }
  if (kind === "devices") {
    const ctx = await live();
    const run = async (c) => (await ctx.exec(c).catch(() => ({ stdout: "" }))).stdout ?? "";
    const rows = new Map();
    for (const line of (await run("head -n 100000 /var/lib/misc/dnsmasq.leases")).split("\n")) {
      const [, mac, ip, host] = line.trim().split(/\s+/);
      if (mac && /^[0-9a-f:]{17}$/i.test(mac)) rows.set(mac.toUpperCase(), { mac: mac.toUpperCase(), ip: ip ?? "", hostname: host && host !== "*" ? host : "", source: "dhcp lease" });
    }
    for (const line of (await run("head -n 100000 /proc/net/arp")).split("\n").slice(1)) {
      const c = line.trim().split(/\s+/);
      if (c.length >= 6 && /^[0-9a-f:]{17}$/i.test(c[3]) && c[2] !== "0x0") {
        const mac = c[3].toUpperCase();
        rows.set(mac, { mac, ip: c[0], hostname: rows.get(mac)?.hostname ?? "", source: rows.has(mac) ? "dhcp lease, online" : "online" });
      }
    }
    return { title: "Devices", columns: ["mac", "ip", "hostname", "source"], rows: [...rows.values()], hidden: 0, model: ctx.info.model };
  }
  if (kind === "history") {
    const rows = app.engine.history().map((r) => ({ id: r.id, at: r.at ?? r.createdAt ?? "", user: r.user ?? "", status: r.status ?? "", settings: (r.items ?? []).map((i) => i.key ?? i.label ?? "").filter(Boolean).join(", ") }));
    return { title: "Change history", columns: ["id", "at", "user", "status", "settings"], rows, hidden: 0, note: "Setting names are listed; values are left out because some are secrets." };
  }
  if (kind === "logs") {
    const ctx = await live();
    const text = (await ctx.exec("tail -n 500 /tmp/syslog.log").catch(() => ({ stdout: "" }))).stdout ?? "";
    const rows = text.split("\n").filter(Boolean).map((line) => ({ time: line.slice(0, 15), message: line.slice(16).replace(/(psk|password|passwd|key|token|secret)=\S+/gi, `$1=${MASKED}`) }));
    return { title: "Router log", columns: ["time", "message"], rows, hidden: 0, model: ctx.info.model };
  }
  return null;
}

function render(format, table, kind) {
  const meta = { kind, exportedAt: new Date().toISOString(), rowCount: table.rows.length, secretsOmitted: table.hidden, note: table.note ?? "", model: table.model ?? "" };
  const d = describe(format);
  if (format === "pdf") {
    const header = [`${table.title} - exported ${meta.exportedAt}`, `${table.rows.length} rows, ${table.hidden} secret value(s) hidden. Latin-1 text only.`, ""];
    const buffer = pdfFile(table.title, [...header, ...tableLines(table)]);
    return { ...d, filename: `${kind}.pdf`, content: buffer.toString("base64"), contentEncoding: "base64", bytes: buffer.length, meta };
  }
  const text = serialize(format, { ...table, meta });
  return { ...d, filename: `${kind}.${d.extension}`, content: text, contentEncoding: "utf8", bytes: Buffer.byteLength(text), meta };
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/formats", () => ({ kinds: KINDS, formats: FORMATS.map(describe), schemaVersion: SCHEMA_VERSION, archives: { zip: { available: true, note: "Relative paths only, a manifest of omitted secrets, UTF-8 names." }, sevenZip: { available: false, note: "In progress: 7z archives with encrypted headers are not built yet. Use ZIP." } } }));

    api.get("/export", async ({ app, live, query, bad }) => {
      const format = String(query.format ?? "json");
      if (!FORMATS.includes(format)) throw bad(`Choose one of: ${FORMATS.join(", ")}.`);
      const table = await collect(String(query.kind ?? ""), { live, app });
      if (!table) throw bad(`Choose one of: ${Object.keys(KINDS).join(", ")}.`);
      let rows = table.rows;
      // An export can be limited to chosen rows (the bulk-selection route).
      if (query.keys) {
        const wanted = new Set(String(query.keys).split(",").filter(Boolean).slice(0, 5000));
        const first = table.columns[0];
        rows = rows.filter((r) => wanted.has(String(r[first])));
      }
      return render(format, { ...table, rows }, String(query.kind));
    });

    // One ZIP with every chosen kind in one chosen format, plus a manifest.
    api.get("/archive", async ({ app, live, query, bad }) => {
      const format = String(query.format ?? "json");
      if (!FORMATS.includes(format)) throw bad(`Choose one of: ${FORMATS.join(", ")}.`);
      const kinds = String(query.kinds ?? "settings,devices,history,logs").split(",").filter((k) => KINDS[k]);
      if (!kinds.length) throw bad("Choose at least one kind of record.");
      const entries = [];
      const manifest = [`Material Asus Router export archive, schema version ${SCHEMA_VERSION}`, `Created: ${new Date().toISOString()}`, `Format of every file: ${format}`, "Secrets: always replaced by (hidden). The count per file is below.", ""];
      for (const kind of kinds) {
        const table = await collect(kind, { live, app });
        const out = render(format, table, kind);
        entries.push({ name: `${kind}/${out.filename}`, data: out.contentEncoding === "base64" ? Buffer.from(out.content, "base64") : Buffer.from(out.content, "utf8") });
        manifest.push(`${kind}/${out.filename}: ${table.rows.length} rows, ${table.hidden} secret value(s) hidden`);
      }
      entries.push({ name: "MANIFEST.txt", data: Buffer.from(`${manifest.join("\n")}\n`, "utf8") });
      const zip = zipFile(entries);
      return { filename: "router-export.zip", mime: "application/zip", content: zip.toString("base64"), contentEncoding: "base64", bytes: zip.length, files: entries.map((e) => e.name), encryptedHeaders: false };
    });

    // Reads an export back and reports what it holds; it changes nothing.
    api.post("/parse", ({ body, bad }) => {
      const format = String(body.format ?? "");
      const text = String(body.text ?? "");
      if (text.length > 4 * 1024 * 1024) throw bad("That file is too large.", 413);
      try {
        const out = parse(format, text);
        return { ...out, rowCount: out.rows.length, loss: LOSS[format] };
      } catch (error) {
        throw bad(error.message);
      }
    }, { limit: 5 * 1024 * 1024 });
  },
};
