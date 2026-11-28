// Small building blocks shared by every screen: element builder, language,
// API client, dialogs and toasts. Nothing here uses innerHTML, so text from
// the router can never turn into markup.

import "./dom-guard.js";

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (["value", "checked", "disabled", "selected", "readOnly", "hidden"].includes(key)) el[key] = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const icon = (name, cls = "") => h("span", { class: `ms ${cls}`.trim(), "aria-hidden": "true" }, name);
export const clear = (el) => (el.replaceChildren(), el);
export const $ = (selector, root = document) => root.querySelector(selector);

// ---- language ---------------------------------------------------------------

const LANGS = ["en", "yue", "both"];
let language = "en";
try {
  const saved = localStorage.getItem("mar.lang");
  language = LANGS.includes(saved) ? saved : navigator.language?.toLowerCase().startsWith("zh") ? "both" : "en";
} catch {}

export const getLang = () => language;
export function setLang(value) {
  language = LANGS.includes(value) ? value : "en";
  try {
    localStorage.setItem("mar.lang", language);
  } catch {}
  document.documentElement.lang = language === "yue" ? "zh-HK" : "en";
  bus.emit("lang");
}

// t("English", "廣東話"): shows one language or both, depending on the switch.
export function t(en, yue) {
  if (language === "en" || !yue || en === yue) return en;
  if (language === "yue") return yue;
  return en.length + yue.length > 44 ? `${en}\n${yue}` : `${en} · ${yue}`;
}
export const tt = (pair) => (pair ? t(pair.en, pair.yue) : "");

// ---- tiny event bus ---------------------------------------------------------

export const bus = {
  map: new Map(),
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.map.get(name).delete(fn);
  },
  emit(name, detail) {
    for (const fn of this.map.get(name) ?? []) fn(detail);
  },
};

// ---- API --------------------------------------------------------------------

export const auth = { csrf: "" };

export async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF": auth.csrf },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw Object.assign(new Error(t("Cannot reach this app. Check that it is still running.", "連唔到呢個程式，請檢查佢仲有冇運行。")), { code: "OFFLINE" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === "SIGNED_OUT") bus.emit("signedout");
    throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, code: data.code, data });
  }
  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  put: (url, body = {}) => request("PUT", url, body),
  patch: (url, body = {}) => request("PATCH", url, body),
  del: (url) => request("DELETE", url),
};

// ---- toasts and dialogs -----------------------------------------------------

export function toast(message, kind = "") {
  const host = $("#toasts");
  if (!host) return;
  const el = h("div", { class: `toast ${kind}`, role: kind === "bad" ? "alert" : "status" }, icon(kind === "bad" ? "error" : "check_circle", "sm"), message);
  host.append(el);
  setTimeout(() => el.remove(), kind === "bad" ? 7000 : 3800);
}

// Opens a modal sheet. build(close) returns the sheet's children.
export function openDialog(build, { label = "" } = {}) {
  const dialog = h("dialog", { "aria-label": label });
  const sheet = h("div", { class: "sheet" });
  dialog.append(sheet);
  let done;
  const closed = new Promise((resolve) => (done = resolve));
  const close = (result) => {
    if (dialog.open) dialog.close();
    dialog.remove();
    done(result);
  };
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close(undefined);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close(undefined);
  });
  document.body.append(dialog);
  const render = () => {
    clear(sheet);
    append(sheet, [build(close, render)]);
  };
  render();
  dialog.showModal();
  return { close, closed, render, sheet };
}

export function confirmDialog({ title, body, confirm, danger = false }) {
  return openDialog(
    (close) => [
      h("h2", { class: "h2" }, title),
      h("p", { class: "muted" }, body),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: `btn ${danger ? "d" : "f"}`, onClick: () => close(true) }, confirm)),
    ],
    { label: title },
  ).closed;
}

export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(t("Copied.", "已複製。"));
  } catch {
    toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad");
  }
};

export const formatUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${hrs}h` : hrs ? `${hrs}h ${m}m` : `${m}m`;
};

export function formatRate(bits) {
  if (bits >= 1e9) return [(bits / 1e9).toFixed(2), "Gbit/s"];
  if (bits >= 1e6) return [(bits / 1e6).toFixed(1), "Mbit/s"];
  if (bits >= 1e3) return [(bits / 1e3).toFixed(0), "kbit/s"];
  return [String(Math.round(bits)), "bit/s"];
}

export const debounce = (fn, ms = 200) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
