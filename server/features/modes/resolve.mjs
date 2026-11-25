// Turns a mode (a list of "set this setting to this value" items) into what the
// router can really do right now: which items exist on this router, what each
// one is now, and whether the whole mode is already in place.
//
// An item is never invented. When the setting is not in the router's own
// settings list (nvram show), or the firmware or model cannot use it, the item
// is marked unavailable with the reason, and it is left out of every write.
import { L } from "../kit.mjs";

const SHOWN_MAX = 80;

export const missing = (key) => L(`This router does not have the setting ${key}`, `呢部路由器冇「${key}」呢個設定`);

const isSecretEntry = (entry) => entry.secret === true || entry.control === "password";

// One value as a person reads it, in both languages.
export function showValue(entry, value) {
  if (value === null || value === undefined) return L("not set", "未設定");
  if (!entry) return L(String(value).slice(0, SHOWN_MAX), String(value).slice(0, SHOWN_MAX));
  if (entry.control === "switch") return value === entry.values?.on ? L("On", "開") : L("Off", "關");
  if ((entry.control === "select" || entry.control === "segmented") && entry.options) {
    const option = entry.options.find(([v]) => v === value);
    if (option) return L(option[1].en, option[1].yue);
  }
  if (value === "") return L("empty", "空");
  if (["number", "slider", "stepper"].includes(entry.control)) {
    const unit = entry.unit ? ` ${String(entry.unit).trim()}` : "";
    return L(`${value}${unit}`, `${value}${unit}`);
  }
  if (value.startsWith("<")) {
    const rows = value.split("<").filter(Boolean).length;
    return L(`${rows} ${rows === 1 ? "entry" : "entries"}`, `${rows} 項`);
  }
  const text = value.length > SHOWN_MAX ? `${value.slice(0, SHOWN_MAX - 1)}…` : value;
  return L(text, text);
}

// templates: [{ id, key, value, shown?, hidden? }]. ctx: { catalog, nvram }.
export function resolveItems(templates, ctx) {
  const byId = new Map(ctx.catalog.map((e) => [e.id, e]));
  return templates.map((template) => {
    const entry = byId.get(template.id) ?? null;
    const key = entry?.key ?? template.key ?? template.id;
    let unavailable = null;
    if (!entry) unavailable = missing(key);
    else if (entry.disabled) unavailable = entry.disabled;
    else if (entry.readOnly) unavailable = L("This setting is read only.", "呢個設定淨係可以睇。");
    else if (isSecretEntry(entry)) unavailable = L("Passwords and keys are never part of a mode.", "密碼同金鑰唔會放入模式。");
    else if (!ctx.nvram.has(entry.key)) unavailable = missing(entry.key);
    const current = entry && ctx.nvram.has(entry.key) ? ctx.nvram.get(entry.key) : null;
    return {
      id: template.id,
      key,
      label: entry?.label ?? L(key, key),
      group: entry?.groupLabel ?? null,
      value: String(template.value),
      current,
      hidden: Boolean(template.hidden),
      essential: Boolean(template.essential),
      unavailable,
      matches: !unavailable && current === String(template.value),
      shownNow: showValue(entry, current),
      shownNew: template.shown ?? showValue(entry, String(template.value)),
    };
  });
}

export const usable = (items) => items.filter((i) => !i.unavailable);
// When a setting the whole mode depends on is missing, the mode cannot be used at all: a Privacy DNS mode that
// could only switch on signature checks would claim to be on while the encryption it is named for was never set.
export const blocker = (items) => items.find((i) => i.essential && i.unavailable)?.unavailable ?? null;
// A mode is on when every item the router can take already has its value, and there is at least one.
export const isActive = (items) => {
  const list = usable(items);
  return !blocker(items) && list.length > 0 && list.every((i) => i.matches);
};
export const changesFor = (items) => (blocker(items) ? [] : usable(items).filter((i) => !i.matches).map((i) => ({ id: i.id, value: i.value })));

export const publicItem = (i) => ({ id: i.id, key: i.key, label: i.label, group: i.group, hidden: i.hidden, unavailable: i.unavailable, matches: i.matches, now: i.shownNow, to: i.shownNew });
