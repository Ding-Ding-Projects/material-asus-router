// The household: who lives here, when they are at work, asleep or at home, and
// how much disturbance each of them will put up with.
//
// "Most brother madness allowed" is a number from 0 to 3, the same scale as the
// impact of a change (0 nothing, 1 a blip, 2 Wi-Fi drops, 3 internet or router
// down). A change whose impact is above what the household allows right now
// is refused, unless the owner overrides it with the four-key confirmation.
//
// PRESENCE has exactly two sources and nothing else:
//   1. whether any of the member's devices is associated to one of the router's
//      home Wi-Fi networks right now (the router's own Wi-Fi client list), and
//   2. optionally, the present state of Home Assistant entities the owner picked.
// There is no ping, no ARP or lease tracking, no location, and nothing about
// presence is ever stored: every answer is read fresh and thrown away.
import { randomUUID } from "node:crypto";
import { isMac } from "../router/shell.mjs";
import { cleanUrl, isEntityId, listEntities, readPresence } from "./homeassistant.mjs";
import { L } from "../features/kit.mjs";

export const HA_TOKEN_KEY = "household.ha.token";
export const BLOCK_KINDS = {
  work: { name: L("At work", "返工"), allowance: 3 },
  sleep: { name: L("Sleeping", "瞓覺"), allowance: 0 },
  home: { name: L("At home", "喺屋企"), allowance: null },
};
const MAX_MEMBERS = 12;
const MAX_BLOCKS = 40;
const MAX_DEVICES = 24;
const MAX_ENTITIES = 12;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

const bad = (message, status = 400, code = "HOUSEHOLD", extra = {}) => Object.assign(new Error(message), { status, code, ...extra });
const level = (value, label, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 3) throw bad(`${label} must be a whole number from 0 to 3.`);
  return n;
};
const text = (value, label, max, { allowEmpty = false } = {}) => {
  const t = String(value ?? "").trim();
  if (!t && !allowEmpty) throw bad(`${label}: enter a value.`);
  if (t.length > max || /[\x00-\x1f<>]/.test(t)) throw bad(`${label}: use ${max} characters or fewer and no line breaks.`);
  return t;
};

export const defaultMember = () => ({
  id: "brother",
  name: "Your brother",
  nameYue: "你兄弟",
  devices: [],
  schedule: [],
  allowances: { work: 3, sleep: 0, home: null },
  homeAllowance: null,
  awayAllowance: 3,
  haEntities: [],
});

export const defaultHousehold = () => ({ madness: 1, members: [defaultMember()], ha: { url: "" }, homeNetworks: { guest: false, picked: null }, tzOffsetMinutes: null });

export const PRESETS = [
  { id: "weekday-work", label: L("My brother is at work on weekdays, 9 to 6", "我個兄弟平日朝九晚六返工"), block: { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", kind: "work" } },
  { id: "night-sleep", label: L("My brother sleeps from 11 at night to 7 in the morning", "我個兄弟夜晚十一點瞓到朝早七點"), block: { days: [0, 1, 2, 3, 4, 5, 6], from: "23:00", to: "07:00", kind: "sleep" } },
  { id: "weekend-home", label: L("My brother is home all day at the weekend", "我個兄弟週末成日喺屋企"), block: { days: [0, 6], from: "08:00", to: "23:00", kind: "home" } },
];

export function cleanBlock(raw) {
  const days = [...new Set((Array.isArray(raw?.days) ? raw.days : []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!days.length) throw bad("Pick at least one day for the time block.");
  if (!TIME.test(String(raw?.from)) || !TIME.test(String(raw?.to))) throw bad("Times look like 09:00 and 18:30.");
  if (raw.from === raw.to) throw bad("A time block cannot start and end at the same time.");
  if (!BLOCK_KINDS[raw.kind]) throw bad("A time block is at work, sleeping or at home.");
  return { id: String(raw.id ?? randomUUID()).slice(0, 40), days, from: raw.from, to: raw.to, kind: raw.kind, allowance: level(raw.allowance, "Allowance") };
}

export function cleanMember(raw, existing = null) {
  const base = existing ?? defaultMember();
  const member = { ...base };
  if (raw.name !== undefined) member.name = text(raw.name, "Name", 60);
  if (raw.nameYue !== undefined) member.nameYue = text(raw.nameYue, "Cantonese name", 60, { allowEmpty: true }) || member.name;
  if (raw.devices !== undefined) {
    if (!Array.isArray(raw.devices) || raw.devices.length > MAX_DEVICES) throw bad(`A person can have up to ${MAX_DEVICES} devices.`);
    member.devices = raw.devices.map((d) => {
      const mac = String(d?.mac ?? "").trim().toUpperCase();
      if (!isMac(mac)) throw bad("Pick devices from the device list.");
      return { mac, label: text(d?.label ?? mac, "Device name", 60, { allowEmpty: true }) || mac };
    });
  }
  if (raw.schedule !== undefined) {
    if (!Array.isArray(raw.schedule) || raw.schedule.length > MAX_BLOCKS) throw bad(`A weekly schedule can have up to ${MAX_BLOCKS} time blocks.`);
    member.schedule = raw.schedule.map(cleanBlock);
  }
  if (raw.allowances !== undefined) {
    member.allowances = { work: level(raw.allowances?.work, "At-work allowance", 3), sleep: level(raw.allowances?.sleep, "Sleeping allowance", 0), home: level(raw.allowances?.home, "At-home allowance", null) };
  }
  if (raw.homeAllowance !== undefined) member.homeAllowance = level(raw.homeAllowance, "Home allowance", null);
  if (raw.awayAllowance !== undefined) member.awayAllowance = level(raw.awayAllowance, "Away allowance", 3);
  if (raw.haEntities !== undefined) {
    if (!Array.isArray(raw.haEntities) || raw.haEntities.length > MAX_ENTITIES) throw bad(`A person can have up to ${MAX_ENTITIES} Home Assistant entities.`);
    member.haEntities = raw.haEntities.map((e) => {
      const entityId = String(e?.entityId ?? e ?? "").trim();
      if (!isEntityId(entityId)) throw bad("Pick Home Assistant entities from the list.");
      return { entityId, name: text(e?.name ?? entityId, "Entity name", 80, { allowEmpty: true }) || entityId };
    });
  }
  return member;
}

export const isConfigured = (member) => member.devices.length > 0 || member.haEntities.length > 0;

// Which time block is it right now? The most protective block wins when blocks overlap.
export function currentBlock(member, madness, date) {
  const day = date.getDay();
  const now = date.getHours() * 60 + date.getMinutes();
  const yesterday = (day + 6) % 7;
  let best = null;
  for (const block of member.schedule) {
    const from = minutes(block.from);
    const to = minutes(block.to);
    const overnight = to <= from;
    const inside = overnight ? (block.days.includes(day) && now >= from) || (block.days.includes(yesterday) && now < to) : block.days.includes(day) && now >= from && now < to;
    if (!inside) continue;
    const allowance = block.allowance ?? member.allowances?.[block.kind] ?? BLOCK_KINDS[block.kind].allowance ?? madness;
    if (!best || allowance < best.allowance) best = { id: block.id, kind: block.kind, allowance, from: block.from, to: block.to };
  }
  return best ?? { id: null, kind: "home", allowance: member.allowances?.home ?? madness, from: null, to: null };
}

// What this person puts up with right now.
// At home: the lower of the time block's allowance and their home allowance.
// Away: the higher of the time block's allowance and their away allowance.
// Unknown counts as at home, because that is the careful guess.
export function memberAllowance(member, presence, madness, date) {
  const block = currentBlock(member, madness, date);
  const homeCap = member.homeAllowance ?? madness;
  const awayCap = member.awayAllowance ?? 3;
  const home = presence !== "away";
  const allowed = home ? Math.min(block.allowance, homeCap) : Math.max(block.allowance, awayCap);
  const kind = BLOCK_KINDS[block.kind].name;
  const reason = home
    ? L(`${member.name} is ${presence === "home" ? "at home" : "possibly at home"} and the schedule says ${kind.en.toLowerCase()}, so up to level ${allowed}.`, `${member.nameYue || member.name}${presence === "home" ? "喺屋企" : "可能喺屋企"}，時間表係「${kind.yue}」，所以最多容許級數 ${allowed}。`)
    : L(`${member.name} is away, so up to level ${allowed}.`, `${member.nameYue || member.name}唔喺屋企，所以最多容許級數 ${allowed}。`);
  return { allowed, block, home, reason };
}

const parseAssoc = (stdout) =>
  String(stdout ?? "")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((cols) => cols[0] === "assoclist" && isMac(cols[1] ?? ""))
    .map((cols) => cols[1].toUpperCase());

export class Household {
  constructor({ store, vault, fetchImpl = fetch, now = () => new Date() }) {
    this.store = store;
    this.vault = vault;
    this.fetch = fetchImpl;
    this.now = now;
  }

  #merge(saved) {
    const base = defaultHousehold();
    if (!saved) return base;
    return { ...base, ...saved, ha: { ...base.ha, ...saved.ha }, homeNetworks: { ...base.homeNetworks, ...saved.homeNetworks } };
  }

  state() {
    return this.#merge(this.store.read().household);
  }

  async #write(fn) {
    let out;
    await this.store.update((s) => {
      const draft = this.#merge(s.household);
      out = fn(draft);
      s.household = draft;
    });
    return out;
  }

  view(s = this.state()) {
    return { ...s, ha: { url: s.ha.url, hasToken: this.vault.has(HA_TOKEN_KEY) }, presets: PRESETS, blockKinds: Object.entries(BLOCK_KINDS).map(([id, k]) => ({ id, name: k.name, allowance: k.allowance })) };
  }

  async update(body) {
    return this.#write((h) => {
      if (body.madness !== undefined) h.madness = level(body.madness, "Most brother madness allowed", 1);
      if (body.homeNetworks !== undefined) {
        const picked = body.homeNetworks.picked;
        if (picked !== null && picked !== undefined && (!Array.isArray(picked) || picked.some((p) => !/^wl\d+(\.\d+)?$|^eth\d+$|^wl[a-z0-9._-]{1,12}$/.test(String(p))))) throw bad("Pick the home Wi-Fi networks from the list.");
        h.homeNetworks = { guest: Boolean(body.homeNetworks.guest), picked: picked ?? null };
      }
      if (body.tzOffsetMinutes !== undefined) {
        const tz = body.tzOffsetMinutes === null ? null : Number(body.tzOffsetMinutes);
        if (tz !== null && (!Number.isInteger(tz) || tz < -840 || tz > 840)) throw bad("The time zone offset is in minutes, from -840 to 840.");
        h.tzOffsetMinutes = tz;
      }
      return this.view(h);
    });
  }

  async addMember(body) {
    return this.#write((h) => {
      if (h.members.length >= MAX_MEMBERS) throw bad(`There can be up to ${MAX_MEMBERS} people.`);
      const member = cleanMember({ name: "New person", ...body }, { ...defaultMember(), id: randomUUID().slice(0, 8), name: "New person", nameYue: "新成員" });
      if (body.nameYue === undefined) member.nameYue = member.name;
      h.members.push(member);
      return member;
    });
  }

  async updateMember(id, body) {
    return this.#write((h) => {
      const index = h.members.findIndex((m) => m.id === id);
      if (index < 0) throw bad("That person is not in the household.", 404);
      h.members[index] = cleanMember(body, h.members[index]);
      return h.members[index];
    });
  }

  async removeMember(id) {
    return this.#write((h) => {
      const index = h.members.findIndex((m) => m.id === id);
      if (index < 0) throw bad("That person is not in the household.", 404);
      h.members.splice(index, 1);
      return { ok: true };
    });
  }

  async setHomeAssistant({ url, token }) {
    const base = url === "" || url === null ? "" : cleanUrl(url);
    if (token) await this.vault.set(HA_TOKEN_KEY, String(token));
    if (!base) await this.vault.delete(HA_TOKEN_KEY);
    await this.#write((h) => void (h.ha = { url: base }));
    return { url: base, hasToken: this.vault.has(HA_TOKEN_KEY) };
  }

  #ha() {
    const { url } = this.state().ha;
    const token = this.vault.get(HA_TOKEN_KEY);
    if (!url || !token) throw bad("Add the Home Assistant address and access token first.", 409, "HOME_ASSISTANT_NOT_SET");
    return { url, token };
  }

  async haEntities() {
    const { url, token } = this.#ha();
    return { entities: await listEntities(url, token, this.fetch) };
  }

  // ---- reading the router --------------------------------------------------

  // The home Wi-Fi networks: every main network, plus guest networks when asked for.
  networkList(ctx) {
    const h = this.state();
    const out = [];
    for (const band of ctx.info.bands) {
      out.push({ ifname: band.ifname, ssid: ctx.nvram.get(`wl${band.index}_ssid`) ?? "", band: band.nband, guest: false, enabled: (ctx.nvram.get(`wl${band.index}_radio`) ?? "1") === "1" });
      for (let n = 1; n <= 3; n += 1) {
        if (ctx.nvram.get(`wl${band.index}.${n}_bss_enabled`) !== "1") continue;
        out.push({ ifname: `wl${band.index}.${n}`, ssid: ctx.nvram.get(`wl${band.index}.${n}_ssid`) ?? "", band: band.nband, guest: true, enabled: true });
      }
    }
    const picked = h.homeNetworks.picked;
    return out.map((net) => ({ ...net, home: picked ? picked.includes(net.ifname) : !net.guest || h.homeNetworks.guest }));
  }

  // The router's Wi-Fi client list, per home network. Returns null when the router cannot be read.
  async clients(ctx) {
    const networks = this.networkList(ctx);
    const out = [];
    try {
      for (const net of networks.filter((n) => n.home && n.enabled)) {
        const res = await ctx.exec(`wl -i ${net.ifname} assoclist`);
        out.push({ ...net, clients: res.code === 0 ? parseAssoc(res.stdout) : [] });
      }
    } catch {
      return null;
    }
    return out;
  }

  // The devices the owner can pick from (names come from the device list).
  async devices(ctx, readDevices) {
    const list = (await readDevices(ctx)).devices ?? [];
    return list.map((d) => ({ mac: d.mac, name: d.name, wireless: d.iface === "wireless" }));
  }

  // Everyone's presence, read fresh, never stored.
  async presence(ctx) {
    const h = this.state();
    const networks = await this.clients(ctx);
    const present = new Map();
    for (const net of networks ?? []) for (const mac of net.clients) present.set(mac, net);
    let haToken = null;
    try {
      haToken = this.#ha();
    } catch {
      haToken = null;
    }
    const members = [];
    for (const member of h.members) {
      const sources = [];
      let wifi = null;
      if (member.devices.length) {
        if (networks === null) wifi = { state: "unknown", reason: "The router could not be read." };
        else {
          const hits = member.devices.filter((d) => present.has(d.mac));
          wifi = { state: hits.length ? "home" : "away", devices: hits.map((d) => ({ mac: d.mac, label: d.label, network: present.get(d.mac).ssid || present.get(d.mac).ifname })) };
        }
        sources.push({ source: "wifi", ...wifi });
      }
      let ha = null;
      if (member.haEntities.length) {
        if (!haToken) ha = { state: "unknown", reason: "Home Assistant is not set up." };
        else {
          const reads = await Promise.all(member.haEntities.map((e) => readPresence(haToken.url, haToken.token, e.entityId, this.fetch).then((r) => ({ entityId: e.entityId, name: e.name, state: r.state, presence: r.presence })).catch((error) => ({ entityId: e.entityId, name: e.name, state: "", presence: "unknown", error: error.message }))));
          const any = (p) => reads.some((r) => r.presence === p);
          ha = { state: any("home") ? "home" : any("away") ? "away" : "unknown", entities: reads };
        }
        sources.push({ source: "homeAssistant", ...ha });
      }
      // Home if either source says home. Away only when a source says away and none says home.
      const states = sources.map((s) => s.state);
      const state = states.includes("home") ? "home" : states.includes("away") ? "away" : "unknown";
      members.push({ id: member.id, name: member.name, nameYue: member.nameYue, configured: isConfigured(member), state, sources });
    }
    return { members, networks: (networks ?? []).map((n) => ({ ifname: n.ifname, ssid: n.ssid, guest: n.guest, clients: n.clients.length })), routerReadable: networks !== null };
  }

  // Nobody's devices are on the home Wi-Fi: the house is quiet.
  async isQuiet(ctx) {
    const networks = await this.clients(ctx);
    if (networks === null) return { quiet: false, known: false, clients: null };
    const clients = networks.reduce((sum, n) => sum + n.clients.length, 0);
    return { quiet: clients === 0, known: true, clients };
  }

  // The most disturbance the household allows right now.
  async allowance(ctx) {
    const h = this.state();
    const presence = await this.presence(ctx);
    const date = this.localDate(h);
    const people = [];
    let allowed = 3;
    let limitedBy = null;
    for (const member of h.members.filter(isConfigured)) {
      const p = presence.members.find((m) => m.id === member.id);
      const result = memberAllowance(member, p?.state ?? "unknown", h.madness, date);
      people.push({ id: member.id, name: member.name, nameYue: member.nameYue, presence: p?.state ?? "unknown", block: result.block, allowed: result.allowed, reason: result.reason });
      if (result.allowed < allowed) {
        allowed = result.allowed;
        limitedBy = member.id;
      }
    }
    return { allowed, madness: h.madness, limitedBy, people, configured: people.length > 0, routerReadable: presence.routerReadable };
  }

  localDate(h = this.state()) {
    const base = this.now();
    if (h.tzOffsetMinutes === null || h.tzOffsetMinutes === undefined) return base;
    const shifted = new Date(base.getTime() + h.tzOffsetMinutes * 60000 + base.getTimezoneOffset() * 60000);
    return shifted;
  }

  // The people a change will touch: everyone set up, or the household as a whole.
  // A member nobody has set up (such as the default placeholder) is never named on
  // their own, so the confirmation agrees with the "Who will notice" banner.
  affectedPeople() {
    const configured = this.state().members.filter(isConfigured);
    if (!configured.length) return [{ id: "household", name: "Everyone at home", nameYue: "屋企所有人" }];
    return configured.map((m) => ({ id: m.id, name: m.name, nameYue: m.nameYue }));
  }
}
