// What can be said about a firmware file without ever sending it anywhere: its
// name, its size and, when recognisable, the kind of image, the router model and
// the version, read from the first few kilobytes and from the file name. This
// file imports nothing and has no way to send anything: it only reads bytes it
// is given. Nothing is ever flashed, and nothing here is a checksum check.

export const HEAD_BYTES = 4096;
export const JSON_LIMIT = 8 * 1024 * 1024;

const ascii = (bytes, from, length) => String.fromCharCode(...bytes.slice(from, from + length));
const startsWith = (bytes, signature) => signature.every((b, i) => bytes[i] === b);

// The kind of file, from the first bytes.
export function kindOf(bytes) {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return { id: "zip", en: "ZIP archive", yue: "ZIP 壓縮檔" };
  if (ascii(bytes, 0, 4) === "HDR0") return { id: "trx", en: "ASUS firmware image (TRX header)", yue: "ASUS 韌體映像（TRX 標頭）" };
  if (startsWith(bytes, [0xd0, 0x0d, 0xfe, 0xed])) return { id: "fit", en: "Flattened image tree (.pkgtb style)", yue: "扁平映像樹（.pkgtb 類）" };
  if (startsWith(bytes, [0x1f, 0x8b])) return { id: "gzip", en: "gzip-compressed file", yue: "gzip 壓縮檔" };
  if (ascii(bytes, 0, 4) === "UBI#") return { id: "ubi", en: "UBI flash image", yue: "UBI 快閃映像" };
  if (ascii(bytes, 0, 4) === "hsqs" || ascii(bytes, 0, 4) === "sqsh") return { id: "squashfs", en: "SquashFS file system", yue: "SquashFS 檔案系統" };
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return { id: "elf", en: "Program file (ELF), not a firmware image", yue: "程式檔（ELF），唔係韌體映像" };
  return { id: "unknown", en: "Not a format this page recognises", yue: "呢頁認唔到嘅格式" };
}

// The name of the first file inside a ZIP, which usually names the image.
export function zipInnerName(bytes) {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytes.length < 31) return null;
  const length = bytes[26] | (bytes[27] << 8);
  if (!length || 30 + length > bytes.length) return null;
  const name = ascii(bytes, 30, length);
  return /^[\x20-\x7e]+$/.test(name) ? name : null;
}

// Model and version from a file name such as RT-AX86U_388.8_4.pkgtb or
// FW_RT_AX86U_300438824198.zip. Returns nulls when the name is not in a known pattern.
export function fromName(name) {
  const base = String(name ?? "").split(/[\\/]/).pop();
  let m = base.match(/^([A-Za-z]{2,3}-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)_(\d{3}\.\d+(?:_[A-Za-z0-9]+)?)/);
  if (m) return { family: "merlin", model: m[1].toUpperCase(), version: m[2] };
  m = base.match(/^FW_([A-Za-z0-9_]+?)_(\d{12})(?:\D|$)/i);
  if (m) {
    const d = m[2];
    return { family: "asus", model: m[1].toUpperCase().replace(/_/g, "-"), version: `${d[0]}.${d[1]}.${d[2]}.${d[3]}.${d.slice(4, 7)}.${d.slice(7)}` };
  }
  return { family: null, model: null, version: null };
}

const squash = (text) => String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const sameModel = (a, b) => Boolean(a && b) && squash(a) === squash(b);

// Everything this page may say about a file.
export function describeFirmware({ name, size, head }) {
  const kind = kindOf(head);
  const inner = kind.id === "zip" ? zipInnerName(head) : null;
  const own = fromName(name);
  const inside = inner ? fromName(inner) : { family: null, model: null, version: null };
  const pick = own.model ? own : inside;
  return { name, size, kind, innerName: inner, family: pick.family, model: pick.model, version: pick.version, from: own.model ? "file name" : inside.model ? "name inside the archive" : null };
}

// Does text have the shape of a personal vocabulary file? Only the shape is
// looked at: a number for the version and a non-empty object or list of words
// under one of the known names. The text is never kept or shown.
export function looksLikePersonalVocabulary(text) {
  let value;
  try {
    value = JSON.parse(String(text).replace(/^﻿/, ""));
  } catch {
    return false;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.version !== "number") return false;
  return ["words", "entries", "terms", "aliases", "dictionary"].some((key) => {
    const part = value[key];
    return part && typeof part === "object" && Object.keys(part).length > 0;
  });
}

// Reads what is needed from a File (or any object with name, size, type, slice and text).
export async function inspectFile(file) {
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const maybeJson = file.size <= JSON_LIMIT && (/\.json$/i.test(file.name) || /json/i.test(file.type ?? "") || (head.length > 0 && [0x7b, 0xef, 0x20, 0x0a, 0x0d, 0x09].includes(head[0]) && !head.includes(0)));
  if (maybeJson) {
    let text = "";
    try {
      text = await file.text();
    } catch {
      text = "";
    }
    const vocabulary = looksLikePersonalVocabulary(text);
    text = "";
    if (vocabulary) return { vocabulary: true };
  }
  return { vocabulary: false, ...describeFirmware({ name: file.name, size: file.size, head }) };
}
