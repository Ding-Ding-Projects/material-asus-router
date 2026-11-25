// Bulk actions on the device list. /devices lists what can be selected, and
// /plan turns a chosen action plus a list of devices into the exact edits, the
// devices it will skip (each with its reason) and the change engine's preview.
// Nothing is written here: the edits go through the pending-changes dock and
// the usual preview, safety net and undo. Removing things (forgetting names,
// freeing reserved addresses) is flagged destructive so the browser asks for
// the two-key confirmation first.
import { isMac, macAddress, parseRows } from "../kit.mjs";

const ID = "bulk-actions";
export const ACTIONS = {
  "forget-names": { destructive: true, label: { en: "Forget the custom names", yue: "忘記自訂名稱" } },
  unreserve: { destructive: true, label: { en: "Free the reserved addresses", yue: "釋放留住嘅地址" } },
  block: { destructive: false, label: { en: "Block from the internet", yue: "封鎖上網" } },
  unblock: { destructive: false, label: { en: "Let back on the internet", yue: "解除封鎖上網" } },
};

async function devices(ctx) {
  const run = async (c) => (await ctx.exec(c).catch(() => ({ stdout: "" }))).stdout ?? "";
  const seen = new Map();
  const upsert = (mac) => {
    const key = mac.toUpperCase();
    if (!seen.has(key)) seen.set(key, { mac: key, ip: "", hostname: "" });
    return seen.get(key);
  };
  for (const line of (await run("head -n 100000 /var/lib/misc/dnsmasq.leases")).split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (mac && isMac(mac)) Object.assign(upsert(mac), { ip: ip ?? "", hostname: host && host !== "*" ? host : "" });
  }
  for (const line of (await run("head -n 100000 /proc/net/arp")).split("\n").slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c.length >= 6 && isMac(c[3]) && c[2] !== "0x0") upsert(c[3]).ip ||= c[0];
  }
  const names = new Map(parseRows(ctx.nvram.get("custom_clientlist")).map((r) => [r[1]?.toUpperCase(), r[0]]));
  const reserved = new Map(parseRows(ctx.nvram.get("dhcp_staticlist")).map((r) => [r[0]?.toUpperCase(), r[1]]));
  const blocked = new Set((ctx.nvram.get("MULTIFILTER_MAC") ?? "").split(">").filter(Boolean).map((m) => m.toUpperCase()));
  return [...seen.values()].map((d) => ({ ...d, customName: names.get(d.mac) ?? "", reservedIp: reserved.get(d.mac) ?? "", blocked: blocked.has(d.mac), name: names.get(d.mac) || d.hostname || d.ip || d.mac })).sort((a, b) => a.name.localeCompare(b.name));
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/devices", async ({ live, query }) => {
      const list = await devices(await live());
      const q = String(query.q ?? "").toLowerCase();
      const rows = q ? list.filter((d) => `${d.name} ${d.mac} ${d.ip}`.toLowerCase().includes(q)) : list;
      return { devices: rows, total: list.length, actions: Object.entries(ACTIONS).map(([id, a]) => ({ id, ...a })) };
    });

    api.post("/plan", async ({ live, preview, body, bad }) => {
      const action = ACTIONS[body.action];
      if (!action) throw bad("Choose one of the listed actions.");
      const macs = [...new Set((Array.isArray(body.macs) ? body.macs : []).map(String))].slice(0, 500);
      if (!macs.length) throw bad("Select at least one device.");
      const list = new Map((await devices(await live())).map((d) => [d.mac, d]));
      const ops = [];
      const items = [];
      const skipped = [];
      for (const raw of macs) {
        let mac;
        try {
          mac = macAddress(raw);
        } catch {
          skipped.push({ mac: raw, reason: "not a valid MAC address" });
          continue;
        }
        const d = list.get(mac);
        if (!d) skipped.push({ mac, reason: "the router no longer lists this device" });
        else if (body.action === "forget-names") d.customName ? (ops.push({ op: "rename", mac, name: "" }), items.push(d)) : skipped.push({ mac, reason: "it has no custom name" });
        else if (body.action === "unreserve") d.reservedIp ? (ops.push({ op: "unreserve", mac }), items.push(d)) : skipped.push({ mac, reason: "it has no reserved address" });
        else if (body.action === "block") d.blocked ? skipped.push({ mac, reason: "it is already blocked" }) : (ops.push({ op: "block", mac, name: d.name.slice(0, 32), blocked: true }), items.push(d));
        else if (body.action === "unblock") d.blocked ? (ops.push({ op: "block", mac, name: d.name.slice(0, 32), blocked: false }), items.push(d)) : skipped.push({ mac, reason: "it is not blocked" });
      }
      const out = { action: body.action, destructive: action.destructive, count: items.length, requested: macs.length, items: items.map((d) => ({ mac: d.mac, name: d.name })), skipped, ops, undoable: true, preview: null };
      if (ops.length) {
        try {
          out.preview = await preview({ ops });
        } catch (error) {
          throw bad(error.message, error.status ?? 400);
        }
      }
      return out;
    });
  },
};
