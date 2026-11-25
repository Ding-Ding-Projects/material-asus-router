// Text for this feature lives in two resource files, strings-en.js and
// strings-yue.js, keyed by name. A key missing from the Cantonese file falls back
// to English, and a key missing from both shows the key itself, so a gap is
// visible rather than blank. {name} placeholders are filled from the values given.
import { EN } from "./strings-en.js";
import { YUE } from "./strings-yue.js";

const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function createI18n(getLang) {
  const one = (table, key, vars) => (key in table ? fill(table[key], vars) : null);
  // tr(key, vars) follows the language switch, the same way the rest of the app does.
  function tr(key, vars = {}) {
    const mode = getLang();
    const en = one(EN, key, vars) ?? key;
    if (mode === "en") return en;
    const yue = one(YUE, key, vars) ?? en;
    if (mode === "yue") return yue;
    if (yue === en) return en;
    return en.length + yue.length > 44 ? `${en}\n${yue}` : `${en} · ${yue}`;
  }
  // Both languages separately, for places that must pick one (speech, tests).
  tr.en = (key, vars = {}) => one(EN, key, vars) ?? key;
  tr.yue = (key, vars = {}) => one(YUE, key, vars) ?? tr.en(key, vars);
  return tr;
}

export const hasKey = (key) => key in EN;
