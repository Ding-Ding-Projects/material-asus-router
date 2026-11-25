// Personal wording. A person can load one small JSON file of their own words
// and the app shows those words instead of the shipped ones, on this browser
// only. The file is checked completely before anything is used, so a bad file
// changes nothing.
//
// The schema (version 1):
//   {
//     "version": 1,
//     "name": "Pat's wording",              optional, shown in the celebration
//     "words": {                             "entries" is accepted as the same thing
//       "router": "gateway",                 an ordinary word or phrase and what to show instead
//       "wireless": { "guest": "visitor" }   groups may nest, up to depth 8; only the last key counts
//     }
//   }
// Limits: 256 KiB of UTF-8, nesting depth 8, keys up to 160 characters, values
// up to 1,000 characters, 5,000 entries, no duplicate keys anywhere.

export const LIMITS = Object.freeze({ bytes: 256 * 1024, depth: 8, keyChars: 160, valueChars: 1000, entries: 5000, nameChars: 80 });

export class VocabError extends Error {
  constructor(code, detail = "") {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

const chars = (s) => [...s].length;
const CONTROL = /[\u0000-\u001f\u007f]/;
const WORDLIKE = /[\p{L}\p{N}]/u;

// Finds a repeated key inside one object, and nesting that is too deep, by
// walking the text once. JSON.parse alone would silently keep the last of two
// equal keys, which is exactly the kind of quiet partial result this refuses.
function scan(textValue) {
  const stack = [];
  for (let i = 0; i < textValue.length; i++) {
    const c = textValue[i];
    if (c === '"') {
      let j = i + 1;
      while (textValue[j] !== '"') j += textValue[j] === "\\" ? 2 : 1;
      const top = stack[stack.length - 1];
      if (top?.type === "object" && top.expectKey) {
        const key = JSON.parse(textValue.slice(i, j + 1));
        if (top.keys.has(key)) throw new VocabError("DUPLICATE_KEY", key.slice(0, 40));
        top.keys.add(key);
        top.expectKey = false;
      }
      i = j;
    } else if (c === "{" || c === "[") {
      stack.push({ type: c === "{" ? "object" : "array", keys: new Set(), expectKey: c === "{" });
      if (stack.length > LIMITS.depth + 1) throw new VocabError("TOO_DEEP");
    } else if (c === "}" || c === "]") stack.pop();
    else if (c === ",") {
      const top = stack[stack.length - 1];
      if (top?.type === "object") top.expectKey = true;
    }
  }
}

function flatten(node, depth, into, path = "") {
  if (depth > LIMITS.depth) throw new VocabError("TOO_DEEP");
  for (const [key, value] of Object.entries(node)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") throw new VocabError("BAD_KEY", key);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, depth + 1, into, `${path}${key}.`);
      continue;
    }
    if (typeof value !== "string") throw new VocabError("BAD_VALUE", `${path}${key}`);
    if (!key.trim() || chars(key) > LIMITS.keyChars || CONTROL.test(key) || !WORDLIKE.test(key)) throw new VocabError("BAD_KEY", key.slice(0, 40));
    if (!value.trim() || chars(value) > LIMITS.valueChars || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new VocabError("BAD_VALUE", key.slice(0, 40));
    const folded = key.trim().normalize("NFC").toLowerCase();
    if (into.has(folded)) throw new VocabError("DUPLICATE_KEY", key.slice(0, 40));
    into.set(folded, value.trim());
    if (into.size > LIMITS.entries) throw new VocabError("TOO_MANY");
  }
}

// Returns { name, entries: Map(lowercase ordinary -> replacement), count } or throws a VocabError.
export function parseVocabulary(input) {
  const source = String(input ?? "").replace(/^﻿/, "");
  if (new TextEncoder().encode(source).length > LIMITS.bytes) throw new VocabError("TOO_BIG");
  if (!source.trim()) throw new VocabError("EMPTY");
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new VocabError("NOT_JSON");
  }
  scan(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new VocabError("NOT_OBJECT");
  for (const key of Object.keys(parsed)) if (!["version", "name", "words", "entries"].includes(key)) throw new VocabError("UNKNOWN_FIELD", key.slice(0, 40));
  if (parsed.version !== 1) throw new VocabError("BAD_VERSION");
  if ("words" in parsed && "entries" in parsed) throw new VocabError("UNKNOWN_FIELD", "entries");
  const words = parsed.words ?? parsed.entries;
  if (!words || typeof words !== "object" || Array.isArray(words)) throw new VocabError("NO_WORDS");
  let name = "";
  if (parsed.name !== undefined) {
    if (typeof parsed.name !== "string" || chars(parsed.name.trim()) > LIMITS.nameChars || CONTROL.test(parsed.name)) throw new VocabError("BAD_NAME");
    name = parsed.name.trim();
  }
  const entries = new Map();
  flatten(words, 1, entries);
  if (!entries.size) throw new VocabError("NO_WORDS");
  return { name, entries, count: entries.size };
}

// The stored form is the canonical text of what was validated, so a damaged
// cache is caught by running the same parser again.
export function serialize({ name, entries }) {
  return JSON.stringify({ version: 1, name, words: Object.fromEntries(entries) });
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const edge = (ch) => WORDLIKE.test(ch) && !CJK.test(ch);

// Builds a function that swaps every whole word or phrase in a piece of text in
// one pass (so a replacement is never replaced again). Latin words match on word
// boundaries; Chinese phrases match anywhere, because Chinese has no spaces.
export function compile(entries) {
  if (!entries || !entries.size) return null;
  const keys = [...entries.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const parts = keys.map((key) => {
    const list = [...key];
    const start = edge(list[0]) ? "(?<![\\p{L}\\p{N}_])" : "";
    const end = edge(list[list.length - 1]) ? "(?![\\p{L}\\p{N}_])" : "";
    return `${start}${escapeRegExp(key)}${end}`;
  });
  const re = new RegExp(parts.join("|"), "giu");
  return (value) => (value && typeof value === "string" ? value.replace(re, (match) => entries.get(match.normalize("NFC").toLowerCase()) ?? match) : value);
}

// Reads the stored copy again and re-validates it. Anything wrong purges it.
export function loadStored(raw) {
  if (raw === null || raw === undefined) return { state: "none" };
  try {
    const v = parseVocabulary(raw);
    return { state: "loaded", ...v, replace: compile(v.entries) };
  } catch (error) {
    return { state: "damaged", code: error.code ?? "BAD" };
  }
}
