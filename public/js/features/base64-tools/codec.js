// The whole Base64 toolkit, with no browser-only calls, so it can be tested
// from Node. Nothing here leaves the device.
const STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const URLSAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const MAPS = { std: new Map([...STANDARD].map((c, i) => [c, i])), url: new Map([...URLSAFE].map((c, i) => [c, i])) };

export class Base64Error extends Error {
  constructor(message, offset) {
    super(`${message} (at offset ${offset})`);
    this.offset = offset;
  }
}

// ---- encoding ---------------------------------------------------------------

// options: urlSafe, padding (default true), lineLength (0 = one line; 76 is
// MIME, 64 is PEM), eol ("\n" or "\r\n").
export function encode(bytes, { urlSafe = false, padding = true, lineLength = 0, eol = "\r\n" } = {}) {
  const alphabet = urlSafe ? URLSAFE : STANDARD;
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
    if (b === undefined) out += padding ? "==" : "";
    else {
      out += alphabet[(n >> 6) & 63];
      if (c === undefined) out += padding ? "=" : "";
      else out += alphabet[n & 63];
    }
  }
  if (!lineLength) return out;
  const lines = [];
  for (let i = 0; i < out.length; i += lineLength) lines.push(out.slice(i, i + lineLength));
  return lines.join(eol);
}

// ---- decoding: a streaming state machine, so offsets are exact and a large
// file never has to be held in memory as text -------------------------------

export class Decoder {
  // strict: only the chosen alphabet, correct padding, no stray bits.
  // mime: line breaks are allowed between groups. lenient: skips what it
  // cannot read and reports each skip as a warning with its offset.
  constructor({ strict = true, urlSafe = false, mime = false, requirePadding = true } = {}) {
    Object.assign(this, { strict, urlSafe, mime, requirePadding, acc: 0, bits: 0, count: 0, pad: 0, padAt: -1, lastVal: 0, lastAt: 0, offset: 0, warnings: [] });
    this.map = strict ? (urlSafe ? MAPS.url : MAPS.std) : null;
    this.name = urlSafe ? "URL-safe" : "standard";
  }

  #problem(message, offset) {
    if (this.strict) throw new Base64Error(message, offset);
    this.warnings.push({ offset, message });
  }

  push(text) {
    const out = [];
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const at = this.offset + i;
      if (ch === "=") {
        if (this.padAt < 0) this.padAt = at;
        this.pad += 1;
        continue;
      }
      if (ch === "\n" || ch === "\r" || ch === " " || ch === "\t") {
        if (this.strict && !(this.mime && (ch === "\n" || ch === "\r"))) throw new Base64Error("Whitespace is not allowed in strict mode", at);
        continue;
      }
      const value = this.strict ? this.map.get(ch) : (MAPS.std.get(ch) ?? MAPS.url.get(ch));
      if (value === undefined) {
        this.#problem(`"${ch}" is not in the ${this.name} alphabet`, at);
        continue;
      }
      if (this.padAt >= 0) {
        this.#problem("Data after the padding", at);
        continue;
      }
      this.acc = (this.acc << 6) | value;
      this.bits += 6;
      this.count += 1;
      this.lastVal = value;
      this.lastAt = at;
      if (this.bits >= 8) {
        this.bits -= 8;
        out.push((this.acc >> this.bits) & 255);
        this.acc &= (1 << this.bits) - 1;
      }
    }
    this.offset += text.length;
    return Uint8Array.from(out);
  }

  finish() {
    const rest = this.count % 4;
    if (rest === 1) this.#problem("The last group has a single character and cannot be decoded", this.offset);
    if (this.pad > 2) this.#problem("More than two padding characters", this.padAt + 2);
    if (this.strict) {
      if (rest === 0 && this.pad > 0) throw new Base64Error("Padding after a complete group", this.padAt);
      if (rest > 1 && this.requirePadding && this.pad !== 4 - rest) throw new Base64Error(`Padding is wrong: expected ${4 - rest} "=" at the end`, this.padAt >= 0 ? this.padAt : this.offset);
      if (rest > 1 && !this.requirePadding && this.pad > 0 && this.pad !== 4 - rest) throw new Base64Error(`Padding is wrong: expected ${4 - rest} "=" or none`, this.padAt);
    }
    if ((rest === 2 && this.lastVal & 0xf) || (rest === 3 && this.lastVal & 0x3)) this.#problem("The last character has bits that a canonical encoder would not set", this.lastAt);
    return this.warnings;
  }
}

export function decode(text, options = {}) {
  const decoder = new Decoder(options);
  const bytes = decoder.push(text);
  const warnings = decoder.finish();
  return { bytes, warnings };
}

// ---- large files: chunks of a Blob, with progress, pause and cancel --------

export class Cancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

// A small control object: pause(), resume(), cancel(). Long jobs await
// control.gate() between chunks.
export function makeControl() {
  let release = null;
  const control = {
    paused: false,
    cancelled: false,
    pause() { control.paused = true; },
    resume() { control.paused = false; release?.(); release = null; },
    cancel() { control.cancelled = true; control.resume(); },
    async gate() {
      if (control.cancelled) throw new Cancelled();
      if (control.paused) await new Promise((resolve) => (release = resolve));
      if (control.cancelled) throw new Cancelled();
    },
  };
  return control;
}

export async function encodeBlob(blob, { control = makeControl(), onProgress = () => {}, chunkLines = 2048, ...options } = {}) {
  const lineLength = options.lineLength || 0;
  if (lineLength && lineLength % 4) throw new Error("A line length must be a multiple of 4.");
  const bytesPerChunk = (lineLength ? (lineLength / 4) * 3 : 3) * chunkLines;
  const eol = options.eol ?? "\r\n";
  const parts = [];
  for (let at = 0; at < blob.size; at += bytesPerChunk) {
    await control.gate();
    const chunk = new Uint8Array(await blob.slice(at, Math.min(blob.size, at + bytesPerChunk)).arrayBuffer());
    parts.push(at ? (lineLength ? eol : "") : "", encode(chunk, options));
    onProgress(Math.min(blob.size, at + bytesPerChunk) / blob.size);
  }
  onProgress(1);
  return new Blob(parts, { type: "text/plain" });
}

export async function decodeBlob(blob, { control = makeControl(), onProgress = () => {}, chunkChars = 1 << 20, ...options } = {}) {
  const decoder = new Decoder(options);
  const parts = [];
  for (let at = 0; at < blob.size; at += chunkChars) {
    await control.gate();
    // Base64 text is ASCII, so one byte is one character.
    const text = new TextDecoder("latin1").decode(await blob.slice(at, Math.min(blob.size, at + chunkChars)).arrayBuffer());
    parts.push(decoder.push(text));
    onProgress(Math.min(blob.size, at + chunkChars) / blob.size);
  }
  const warnings = decoder.finish();
  onProgress(1);
  return { blob: new Blob(parts), warnings };
}

export async function sha256(input) {
  const bytes = input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : input;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Web Crypto has no incremental hash, so a very large file is hashed by
// reading it once; above this size the hash is reported as not computed.
export const HASH_LIMIT = 512 << 20;
export const sha256Blob = async (blob) => (blob.size > HASH_LIMIT ? null : sha256(blob));

// ---- text encodings ---------------------------------------------------------

export const TEXT_ENCODINGS = [["utf-8", "UTF-8"], ["utf-16le", "UTF-16 LE"], ["utf-16be", "UTF-16 BE"], ["latin1", "Latin-1 (ISO 8859-1)"], ["ascii", "ASCII"]];

export function textToBytes(text, encoding = "utf-8") {
  if (encoding === "utf-8") return new TextEncoder().encode(text);
  if (encoding === "utf-16le" || encoding === "utf-16be") {
    const out = new Uint8Array(text.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < text.length; i += 1) view.setUint16(i * 2, text.charCodeAt(i), encoding === "utf-16le");
    return out;
  }
  const limit = encoding === "ascii" ? 127 : 255;
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > limit) throw new Error(`"${text[i]}" cannot be written as ${encoding === "ascii" ? "ASCII" : "Latin-1"} (position ${i}). Pick UTF-8 to keep every character.`);
    out[i] = code;
  }
  return out;
}

export function bytesToText(bytes, encoding = "utf-8", { fatal = false } = {}) {
  if (encoding === "ascii") return Array.from(bytes, (b) => String.fromCharCode(b & 127)).join("");
  if (encoding === "latin1") return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return new TextDecoder(encoding, { fatal }).decode(bytes);
}

// ---- data: URLs -------------------------------------------------------------

export function buildDataUrl(mime, bytes, { base64 = true } = {}) {
  const type = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mime) ? mime : "application/octet-stream";
  if (base64) return `data:${type};base64,${encode(bytes)}`;
  return `data:${type},${Array.from(bytes, (b) => (/[A-Za-z0-9\-_.~]/.test(String.fromCharCode(b)) ? String.fromCharCode(b) : `%${b.toString(16).toUpperCase().padStart(2, "0")}`)).join("")}`;
}

export function parseDataUrl(text) {
  const m = /^data:([^,]*?),([\s\S]*)$/i.exec(String(text).trim());
  if (!m) throw new Error('A data URL looks like data:text/plain;base64,SGVsbG8= (it must start with "data:" and have a comma).');
  const parts = m[1].split(";").map((p) => p.trim()).filter(Boolean);
  const base64 = parts.length > 0 && parts.at(-1).toLowerCase() === "base64";
  if (base64) parts.pop();
  const mime = parts[0]?.includes("/") ? parts.shift() : "text/plain";
  if (base64) return { mime, params: parts, base64, bytes: decode(m[2], { strict: false }).bytes };
  const bytes = [];
  for (let i = 0; i < m[2].length; i += 1) {
    if (m[2][i] === "%") {
      const hex = m[2].slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex)) throw new Error(`Bad percent escape at position ${i}.`);
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(m[2][i]));
  }
  return { mime, params: parts, base64, bytes: Uint8Array.from(bytes) };
}

// ---- hex view ---------------------------------------------------------------

export function hexView(bytes, { width = 16, limit = 4096 } = {}) {
  const lines = [];
  const end = Math.min(bytes.length, limit);
  for (let at = 0; at < end; at += width) {
    const row = bytes.subarray(at, Math.min(end, at + width));
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = Array.from(row, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${at.toString(16).padStart(8, "0")}  ${hex.padEnd(width * 3 - 1)}  |${ascii}|`);
  }
  if (bytes.length > end) lines.push(`... ${bytes.length - end} more bytes`);
  return lines.join("\n");
}

// ---- file names: the drop rule ---------------------------------------------

export const ENCODED_SUFFIX = ".base64.txt";
// photo.png -> photo.png.base64.txt; dropping that file restores photo.png.
export const encodedName = (name) => `${name}${ENCODED_SUFFIX}`;
export const restoredName = (name) => (name.toLowerCase().endsWith(ENCODED_SUFFIX) && name.length > ENCODED_SUFFIX.length ? name.slice(0, -ENCODED_SUFFIX.length) : null);
// Never overwrite: if the name is taken, "name (2).ext" is used.
export function uniqueName(name, taken) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (taken.has(`${stem} (${n})${ext}`)) n += 1;
  return `${stem} (${n})${ext}`;
}

// ---- history with undo ------------------------------------------------------

export const HISTORY_LIMIT = 50;
export function pushHistory(list, entry, limit = HISTORY_LIMIT) {
  return [{ id: `${Date.now().toString(36)}-${list.length}`, at: new Date().toISOString(), ...entry }, ...list].slice(0, limit);
}
// Undo removes the newest entry and returns it, so the caller can restore its input.
export function undoHistory(list) {
  return list.length ? { list: list.slice(1), undone: list[0] } : { list, undone: null };
}
