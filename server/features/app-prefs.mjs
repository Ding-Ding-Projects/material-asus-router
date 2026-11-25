// A feature's own preferences: settings of this app (a speed test server, how many rows a chart shows) that
// never belong in the router. They are saved in the app's data folder, next to the feature's other state, and
// they are never written to the router's settings, so a router that lacks a setting is never given one.
//
// A feature declares them like catalogue entries (id, control, label, help, the control's own fields) plus a
// `key` (the name the preference is saved under) and a `default`. The helper reads them (a Map of key -> text),
// builds the entries the browser draws with the same rich controls, checks a change and saves it.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const CTRL = /[\x00-\x1f<>]/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;
const CHIP = /^[A-Za-z0-9._-]{1,64}$/;

const refuse = (def, message) => {
  throw Object.assign(new Error(`${def.label.en}: ${message}`), { status: 400 });
};

// Returns the text to save, or throws a 400 saying what to fix.
export function checkPref(def, value) {
  const text = value === undefined || value === null ? "" : String(value);
  switch (def.control) {
    case "switch":
      if (![def.values.on, def.values.off].includes(text)) refuse(def, "choose on or off.");
      return text;
    case "select":
    case "segmented":
      if (!def.options.some(([v]) => v === text)) refuse(def, "choose one of the listed options.");
      return text;
    case "number":
    case "slider":
    case "stepper": {
      const n = Number(text);
      if (text === "" || !Number.isInteger(n) || n < def.min || n > def.max) refuse(def, `enter a whole number from ${def.min} to ${def.max}.`);
      return String(n);
    }
    case "hostname":
      if (def.optional && text === "") return "";
      if (!HOSTNAME.test(text)) refuse(def, "enter a host name such as pool.ntp.org.");
      return text;
    case "color":
      if (!HEX.test(text)) refuse(def, "enter a colour such as #3366cc.");
      return text.toLowerCase();
    case "chips": {
      const items = text === "" ? [] : text.split(def.delimiter ?? ",");
      if (items.length > (def.maxItems ?? 50)) refuse(def, `choose at most ${def.maxItems ?? 50}.`);
      for (const item of items) {
        if (def.options ? !def.options.some(([v]) => v === item) : !CHIP.test(item)) refuse(def, `"${item}" is not allowed here.`);
      }
      if (new Set(items).size !== items.length) refuse(def, "each item can be chosen once.");
      return items.join(def.delimiter ?? ",");
    }
    case "text":
      if (text.length < (def.minLength ?? 0) || text.length > (def.maxLength ?? 256)) refuse(def, `use ${def.minLength ?? 0} to ${def.maxLength ?? 256} characters.`);
      if (CTRL.test(text)) refuse(def, "remove line breaks and the < and > characters.");
      return text;
    default:
      return refuse(def, "this kind of control is not available for app preferences.");
  }
}

// A sample that differs from the current value, and one that must be refused, for the feature tests.
export function samplePref(def, current) {
  const other = (list) => String(list.find((x) => String(x) !== String(current)) ?? list[0]);
  switch (def.control) {
    case "switch": return other([def.values.on, def.values.off]);
    case "select": case "segmented": return other(def.options.map(([v]) => v));
    case "number": case "slider": case "stepper": return other([def.min, def.max, Math.round((def.min + def.max) / 2)]);
    case "hostname": return other(["speed.example.net", "check.example.net"]);
    case "color": return other(["#3366cc", "#cc6633"]);
    case "chips": return def.options ? other([def.options[0][0], def.options[1]?.[0] ?? def.options[0][0]]) : other(["alpha", "beta"]);
    default: return other(["Welcome", "Hello there"].map((x) => x.slice(0, def.maxLength ?? 256)));
  }
}

export function appPrefs(featureId, defs) {
  const file = () => path.join(path.resolve(process.env.DATA_DIR ?? "./data"), "features", `${featureId}-prefs.json`);
  let queue = Promise.resolve();
  const byId = new Map(defs.map((d) => [d.id, d]));
  const byKey = new Map(defs.map((d) => [d.key, d]));

  // What is saved, as text: a Map of key -> value. A saved value that no longer passes its check falls back to the default.
  async function read() {
    let saved = {};
    try {
      saved = JSON.parse(await readFile(file(), "utf8")) ?? {};
    } catch {}
    const out = new Map();
    for (const def of defs) {
      let value = String(def.default ?? "");
      if (Object.hasOwn(saved, def.key)) {
        try {
          value = checkPref(def, saved[def.key]);
        } catch {}
      }
      out.set(def.key, value);
    }
    return out;
  }

  // The entries the browser draws, each with its saved value.
  const entries = (values) => defs.map((def) => ({ ...def, appSetting: true, value: values.get(def.key) ?? "", domain: def.domain ?? featureId }));

  // changes: [{ id, value }]. Checks all of them first, then saves them together.
  function save(changes) {
    if (!Array.isArray(changes) || !changes.length) throw Object.assign(new Error("Send at least one change."), { status: 400 });
    const checked = changes.map((c) => {
      const def = byId.get(String(c?.id ?? ""));
      if (!def) throw Object.assign(new Error("That preference does not exist."), { status: 404 });
      return [def.key, checkPref(def, c.value)];
    });
    const run = queue.then(async () => {
      const values = Object.fromEntries(await read());
      for (const [key, value] of checked) values[key] = value;
      await mkdir(path.dirname(file()), { recursive: true });
      const tmp = `${file()}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(values), { mode: 0o600 });
      await rename(tmp, file());
      return new Map(Object.entries(values));
    });
    queue = run.catch(() => {});
    return run;
  }

  return {
    defs,
    byId,
    byKey,
    read,
    entries,
    save,
    // GET /prefs and PUT /prefs under /api/x/<feature>. Viewers may read; only people who can write may save.
    routes(api) {
      api.get("/prefs", async () => entries(await read()).map((e) => ({ id: e.id, value: e.value })));
      api.put("/prefs", async ({ body }) => {
        const values = await save(body.changes ?? [{ id: body.id, value: body.value }]);
        return { entries: entries(values) };
      });
    },
  };
}
