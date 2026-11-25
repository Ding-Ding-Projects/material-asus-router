// The converters of the universal local file converter, with no browser-only
// calls so they can be tested from Node. Every conversion runs on this device.
// Each one returns { text | bytes, lossy: [sentences] } and says out loud what
// a conversion cannot keep.

// ---- type detection: a bounded look at the first bytes ---------------------

const MAGIC = [
  ["png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["jpeg", "image/jpeg", [0xff, 0xd8, 0xff]],
  ["gif", "image/gif", [0x47, 0x49, 0x46, 0x38]],
  ["bmp", "image/bmp", [0x42, 0x4d]],
  ["pdf", "application/pdf", [0x25, 0x50, 0x44, 0x46]],
  ["zip", "application/zip", [0x50, 0x4b, 0x03, 0x04]],
  ["gzip", "application/gzip", [0x1f, 0x8b]],
  ["7z", "application/x-7z-compressed", [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]],
  ["ogg", "audio/ogg", [0x4f, 0x67, 0x67, 0x53]],
  ["flac", "audio/flac", [0x66, 0x4c, 0x61, 0x43]],
  ["mp3", "audio/mpeg", [0x49, 0x44, 0x33]],
];
export const DETECT_LIMIT = 4096;

export function detectType(bytes, name = "") {
  const head = bytes.subarray(0, DETECT_LIMIT);
  const at = (offset, list) => list.every((b, i) => head[offset + i] === b);
  for (const [id, mime, magic] of MAGIC) if (at(0, magic)) return { id, mime, how: "magic bytes" };
  const ascii = (offset, text) => [...text].every((c, i) => head[offset + i] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { id: "webp", mime: "image/webp", how: "magic bytes" };
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return { id: "wav", mime: "audio/wav", how: "magic bytes" };
  if (ascii(4, "ftyp")) return { id: "mp4", mime: "video/mp4", how: "magic bytes" };
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { id: "webm", mime: "video/webm", how: "magic bytes" };
  if (at(0, [0xff, 0xfe]) || at(0, [0xfe, 0xff])) return { id: "text-utf16", mime: "text/plain", how: "byte order mark" };
  if (head.includes(0)) return { id: "binary", mime: "application/octet-stream", how: "contains zero bytes" };
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(0, head.length - (head.length === DETECT_LIMIT ? 3 : 0)));
  } catch {
    return { id: "text-8bit", mime: "text/plain", how: "not valid UTF-8" };
  }
  const trimmed = text.replace(/^﻿/, "").trimStart();
  if (/^<svg[\s>]|^<\?xml[\s\S]*<svg[\s>]/i.test(trimmed)) return { id: "svg", mime: "image/svg+xml", how: "markup" };
  if (/^<\?xml|^<[A-Za-z][\w:.-]*[\s>/]/.test(trimmed)) return { id: "xml", mime: "application/xml", how: "markup" };
  if (/^[[{]/.test(trimmed)) {
    try {
      if (bytes.length <= DETECT_LIMIT) JSON.parse(trimmed);
      return { id: "json", mime: "application/json", how: bytes.length <= DETECT_LIMIT ? "parsed" : "starts like JSON" };
    } catch {}
  }
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "csv" || ext === "tsv" || (/^[^\n]*[,\t][^\n]*\n[^\n]*[,\t]/.test(trimmed) && !/^\s*[-#]/.test(trimmed))) return { id: "csv", mime: "text/csv", how: ext === "csv" || ext === "tsv" ? "file name" : "delimited lines" };
  if (ext === "yaml" || ext === "yml" || /^---\s*\n|^[\w"'-]+:\s/m.test(trimmed)) return { id: "yaml", mime: "application/yaml", how: ext === "yaml" || ext === "yml" ? "file name" : "key: value lines" };
  return { id: "text", mime: "text/plain", how: "valid UTF-8 text" };
}

// ---- text encodings and line endings ---------------------------------------

export const ENCODINGS = [["utf-8", "UTF-8"], ["utf-8-bom", "UTF-8 with BOM"], ["utf-16le", "UTF-16 LE"], ["utf-16be", "UTF-16 BE"], ["windows-1252", "Windows-1252"], ["latin1", "Latin-1"], ["ascii", "ASCII"]];

// Picks the encoding from a byte order mark, then valid UTF-8, then Latin-1.
export function sniffEncoding(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8-bom";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

export function decodeText(bytes, encoding) {
  if (encoding === "utf-8-bom") return new TextDecoder("utf-8").decode(bytes.subarray(bytes[0] === 0xef ? 3 : 0));
  if (encoding === "utf-16le" || encoding === "utf-16be") {
    const start = (encoding === "utf-16le" && bytes[0] === 0xff && bytes[1] === 0xfe) || (encoding === "utf-16be" && bytes[0] === 0xfe && bytes[1] === 0xff) ? 2 : 0;
    return new TextDecoder(encoding).decode(bytes.subarray(start));
  }
  if (encoding === "latin1" || encoding === "ascii") return Array.from(bytes, (b) => String.fromCharCode(encoding === "ascii" ? b & 127 : b)).join("");
  return new TextDecoder(encoding).decode(bytes);
}

const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";

// Returns { bytes, lossy }. Characters the target cannot hold become "?" and
// are counted, never dropped silently.
export function encodeText(text, encoding) {
  const lossy = [];
  if (encoding === "utf-8") return { bytes: new TextEncoder().encode(text), lossy };
  if (encoding === "utf-8-bom") return { bytes: Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]), lossy };
  if (encoding === "utf-16le" || encoding === "utf-16be") {
    const out = new Uint8Array(2 + text.length * 2);
    const view = new DataView(out.buffer);
    view.setUint16(0, 0xfeff, encoding === "utf-16le");
    for (let i = 0; i < text.length; i += 1) view.setUint16(2 + i * 2, text.charCodeAt(i), encoding === "utf-16le");
    return { bytes: out, lossy };
  }
  let replaced = 0;
  const out = Uint8Array.from(text, (ch) => {
    const code = ch.codePointAt(0);
    if (encoding === "ascii") return code < 128 ? code : (replaced += 1, 63);
    if (encoding === "latin1") return code < 256 ? code : (replaced += 1, 63);
    if (code < 128 || (code >= 160 && code < 256)) return code;
    const index = CP1252.indexOf(ch);
    return index >= 0 ? 128 + index : (replaced += 1, 63);
  });
  if (replaced) lossy.push(`${replaced} character(s) are not in ${encoding} and were written as "?".`);
  return { bytes: out, lossy };
}

export function convertEncoding(bytes, from, to, { eol = "keep" } = {}) {
  let text = decodeText(bytes, from === "auto" ? sniffEncoding(bytes) : from);
  if (eol === "lf") text = text.replace(/\r\n?/g, "\n");
  if (eol === "crlf") text = text.replace(/\r\n?|\n/g, "\r\n");
  return encodeText(text, to);
}

// ---- hex and binary text -----------------------------------------------------

export const bytesToHex = (bytes, { upper = false, separator = " " } = {}) => Array.from(bytes, (b) => (upper ? b.toString(16).toUpperCase() : b.toString(16)).padStart(2, "0")).join(separator);
export function hexToBytes(text) {
  const clean = text.replace(/0x/gi, "").replace(/[\s,:-]/g, "");
  if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error("Hex text needs pairs of 0-9 and a-f; spaces and commas are allowed.");
  return Uint8Array.from(clean.match(/../g) ?? [], (p) => parseInt(p, 16));
}
export const bytesToBinaryText = (bytes) => Array.from(bytes, (b) => b.toString(2).padStart(8, "0")).join(" ");

// ---- JSON / YAML / CSV / XML -------------------------------------------------

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch (strictError) {
    // Comments and trailing commas are the usual reasons for a refusal.
    const cleaned = text.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, s) => s ?? "").replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch {
      throw strictError;
    }
  }
}

// -- YAML (the practical subset: maps, lists, scalars, flow collections, block scalars)

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) {
      if (c === "\\" && quote === '"') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function yamlScalar(raw) {
  const s = raw.trim();
  if (s === "" || s === "~" || /^null$/i.test(s)) return null;
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^[-+]?\d+$/.test(s) && Number.isSafeInteger(Number(s))) return Number(s);
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  if (s[0] === '"') return JSON.parse(s);
  if (s[0] === "'") return s.slice(1, -1).replaceAll("''", "'");
  if (s[0] === "[" || s[0] === "{") return yamlFlow(s);
  if (/^[&*!]/.test(s)) throw new Error(`YAML anchors, aliases and tags are not supported (found "${s.slice(0, 12)}").`);
  return s;
}

function yamlFlow(text) {
  let i = 0;
  const skip = () => { while (/\s/.test(text[i] ?? "")) i += 1; };
  function value() {
    skip();
    if (text[i] === "[") {
      i += 1;
      const list = [];
      skip();
      while (text[i] !== "]") {
        list.push(value());
        skip();
        if (text[i] === ",") i += 1;
        else if (text[i] !== "]") throw new Error(`Bad flow list near "${text.slice(i, i + 10)}".`);
        skip();
      }
      i += 1;
      return list;
    }
    if (text[i] === "{") {
      i += 1;
      const map = {};
      skip();
      while (text[i] !== "}") {
        const key = String(scalarToken(":"));
        skip();
        if (text[i] !== ":") throw new Error(`Expected ":" in a flow map near "${text.slice(i, i + 10)}".`);
        i += 1;
        map[key] = value();
        skip();
        if (text[i] === ",") i += 1;
        else if (text[i] !== "}") throw new Error(`Bad flow map near "${text.slice(i, i + 10)}".`);
        skip();
      }
      i += 1;
      return map;
    }
    return scalarToken(",]}");
  }
  function scalarToken(stops) {
    skip();
    if (text[i] === '"' || text[i] === "'") {
      const q = text[i];
      let j = i + 1;
      while (j < text.length && (text[j] !== q || (q === '"' && text[j - 1] === "\\"))) j += 1;
      const token = text.slice(i, j + 1);
      i = j + 1;
      return yamlScalar(token);
    }
    let j = i;
    while (j < text.length && !stops.includes(text[j])) j += 1;
    const token = text.slice(i, j);
    i = j;
    return yamlScalar(token);
  }
  const out = value();
  skip();
  if (i < text.length) throw new Error(`Unexpected text after a flow collection: "${text.slice(i, i + 10)}".`);
  return out;
}

export function parseYaml(text) {
  const raw = text.replace(/^﻿/, "").split(/\r?\n/);
  const lines = [];
  raw.forEach((line, index) => {
    const body = stripComment(line).trimEnd();
    if (!body.trim() || /^(---|\.\.\.)\s*$/.test(body.trim())) return;
    if (/^\t/.test(line)) throw new Error(`Line ${index + 1}: YAML indents with spaces, not tabs.`);
    lines.push({ indent: body.length - body.trimStart().length, text: body.trim(), raw: line, no: index + 1 });
  });
  if (!lines.length) return null;
  let at = 0;
  const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:#][^:]*?)\s*:(?:\s+(.*))?$/;

  function block(indent) {
    const line = lines[at];
    if (line.text === "-" || line.text.startsWith("- ")) return sequence(line.indent);
    if (KEY.test(line.text)) return mapping(line.indent);
    at += 1;
    return yamlScalar(line.text);
  }
  function sequence(indent) {
    const list = [];
    while (at < lines.length && lines[at].indent === indent && (lines[at].text === "-" || lines[at].text.startsWith("- "))) {
      const line = lines[at];
      const rest = line.text.slice(1).trim();
      if (!rest) {
        at += 1;
        list.push(at < lines.length && lines[at].indent > indent ? block(lines[at].indent) : null);
      } else if (KEY.test(rest) && !/^["'[{]/.test(rest.slice(0, 1)) || /^("[^"]*"|'[^']*')\s*:/.test(rest)) {
        // "- key: value" starts a map whose keys line up after the dash.
        lines[at] = { ...line, indent: indent + (line.text.length - line.text.slice(1).trimStart().length), text: rest };
        list.push(mapping(lines[at].indent));
      } else {
        at += 1;
        list.push(yamlScalar(rest));
      }
    }
    return list;
  }
  function mapping(indent) {
    const map = {};
    while (at < lines.length && lines[at].indent === indent && KEY.test(lines[at].text)) {
      const line = lines[at];
      const [, rawKey, rest = ""] = KEY.exec(line.text);
      const key = rawKey[0] === '"' || rawKey[0] === "'" ? yamlScalar(rawKey) : rawKey.trim();
      at += 1;
      if (/^[|>][+-]?$/.test(rest.trim())) {
        const parts = [];
        const base = at < lines.length ? lines[at].indent : indent + 1;
        let probe = raw.indexOf(line.raw, line.no - 1) + 1;
        while (probe < raw.length) {
          const next = raw[probe];
          if (next.trim() && next.length - next.trimStart().length <= indent) break;
          parts.push(next.trim() ? next.slice(Math.min(base, next.length - next.trimStart().length)) : "");
          probe += 1;
        }
        while (at < lines.length && lines[at].no <= probe) at += 1;
        while (parts.length && parts.at(-1) === "") parts.pop();
        const folded = rest.trim()[0] === ">";
        map[key] = (folded ? parts.join(" ").replace(/ {2,}/g, " ") : parts.join("\n")) + (rest.trim().endsWith("-") ? "" : "\n");
      } else if (rest.trim() === "") {
        if (at < lines.length && lines[at].indent > indent) map[key] = block(lines[at].indent);
        else if (at < lines.length && lines[at].indent === indent && (lines[at].text === "-" || lines[at].text.startsWith("- "))) map[key] = sequence(indent);
        else map[key] = null;
      } else map[key] = yamlScalar(rest);
    }
    return map;
  }
  const value = block(lines[0].indent);
  if (at < lines.length) throw new Error(`Line ${lines[at].no}: this line is indented or shaped in a way the YAML reader does not understand ("${lines[at].text.slice(0, 30)}").`);
  return value;
}

function yamlString(v) {
  const risky = v === "" || /^\s|\s$/.test(v) || /^[-?:,[\]{}#&*!|>'"%@`]/.test(v) || /:\s|\s#|:$/.test(v) || /^(null|true|false|~|yes|no|on|off|y|n)$/i.test(v) || (/^[-+]?[.\d]/.test(v) && !Number.isNaN(Number(v))) || /[\n\r\t]/.test(v);
  return risky ? JSON.stringify(v) : v;
}
const yamlAtom = (v) => (v === null ? "null" : typeof v === "string" ? yamlString(v) : String(v));

export function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]`;
    return value.map((item) => {
      if (item !== null && typeof item === "object" && (Array.isArray(item) ? item.length : Object.keys(item).length)) {
        const inner = toYaml(item, indent + 2).split("\n");
        inner[0] = `${pad}- ${inner[0].slice(indent + 2)}`;
        return inner.join("\n");
      }
      return `${pad}- ${Array.isArray(item) ? "[]" : isPlain(item) ? "{}" : yamlAtom(item)}`;
    }).join("\n");
  }
  if (isPlain(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return `${pad}{}`;
    return keys.map((key) => {
      const v = value[key];
      const k = yamlString(key);
      if (v !== null && typeof v === "object" && (Array.isArray(v) ? v.length : Object.keys(v).length)) return `${pad}${k}:\n${toYaml(v, indent + (Array.isArray(v) ? 2 : 2))}`;
      return `${pad}${k}: ${Array.isArray(v) ? "[]" : isPlain(v) ? "{}" : yamlAtom(v)}`;
    }).join("\n");
  }
  return `${pad}${yamlAtom(value)}`;
}

// -- CSV (RFC 4180: quotes, doubled quotes, newlines inside quotes)

export function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("A quoted CSV field is never closed.");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function toCsv(rows, delimiter = ",") {
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(delimiter) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(delimiter)).join("\r\n");
}

const detectScalar = (s) => (s === "" ? null : /^(true|false)$/i.test(s) ? s.toLowerCase() === "true" : /^-?(0|[1-9]\d*)(\.\d+)?$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : s);
export function csvToRecords(rows, { header = true, detect = false } = {}) {
  if (!rows.length) return [];
  const conv = detect ? detectScalar : (s) => s;
  if (!header) return rows.map((r) => r.map(conv));
  const [names, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(names.map((n, i) => [n, conv(r[i] ?? "")])));
}
export function recordsToRows(value) {
  const list = Array.isArray(value) ? value : isPlain(value) ? [value] : null;
  if (!list) throw new Error("CSV needs a list of records, but this data is a single value.");
  if (list.every(Array.isArray)) return list;
  if (!list.every(isPlain)) throw new Error("CSV needs every item to be a record (an object) or every item to be a list.");
  const names = [...new Set(list.flatMap((r) => Object.keys(r)))];
  return [names, ...list.map((r) => names.map((n) => r[n]))];
}

// -- XML

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m));
const escapeXml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function parseXml(text) {
  const token = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)|(<)/g;
  const root = { name: "#root", attrs: {}, kids: [], text: "" };
  const stack = [root];
  let m;
  while ((m = token.exec(text))) {
    const top = stack.at(-1);
    if (m[7]) throw new Error(`Bad XML near position ${m.index}: a "<" that does not start a tag.`);
    if (m[1] !== undefined) top.text += m[1];
    else if (m[6] !== undefined) top.text += unescapeXml(m[6]);
    else if (m[2]) {
      if (stack.length < 2 || top.name !== m[2]) throw new Error(`Bad XML near position ${m.index}: </${m[2]}> closes ${stack.length < 2 ? "nothing" : `<${top.name}>`}.`);
      stack.pop();
    } else if (m[3]) {
      const node = { name: m[3], attrs: {}, kids: [], text: "" };
      for (const a of (m[4] ?? "").matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) node.attrs[a[1]] = unescapeXml(a[3] ?? a[4]);
      top.kids.push(node);
      if (!m[5]) stack.push(node);
    }
  }
  if (stack.length > 1) throw new Error(`Bad XML: <${stack.at(-1).name}> is never closed.`);
  if (root.kids.length !== 1) throw new Error("XML needs exactly one root element.");
  const toValue = (node) => {
    const names = Object.keys(node.attrs);
    const text = node.text.trim();
    if (!names.length && !node.kids.length) return text;
    const out = {};
    for (const n of names) out[`@${n}`] = node.attrs[n];
    for (const kid of node.kids) {
      const v = toValue(kid);
      out[kid.name] = kid.name in out ? [].concat(out[kid.name], [v]) : v;
    }
    if (text) out["#text"] = text;
    return out;
  };
  return { [root.kids[0].name]: toValue(root.kids[0]) };
}

export function toXml(value, { root = "root", item = "item", indent = 2 } = {}, lossy = []) {
  const fixed = (name) => {
    const clean = String(name).replace(/[^A-Za-z0-9_.-]/g, "_").replace(/^([^A-Za-z_])/, "_$1");
    if (clean !== name) lossy.push(`The name "${name}" is not valid in XML and became "${clean}".`);
    return clean;
  };
  const pad = (n) => " ".repeat(n * indent);
  function emit(name, v, depth) {
    const tag = fixed(name);
    if (Array.isArray(v)) return v.map((x) => emit(name, x, depth)).join("\n");
    if (v === null || v === undefined) return `${pad(depth)}<${tag}/>`;
    if (!isPlain(v)) return `${pad(depth)}<${tag}>${escapeXml(v)}</${tag}>`;
    const attrs = Object.keys(v).filter((k) => k.startsWith("@")).map((k) => ` ${fixed(k.slice(1))}="${escapeXml(v[k])}"`).join("");
    const kids = Object.keys(v).filter((k) => !k.startsWith("@") && k !== "#text");
    const body = v["#text"] !== undefined ? escapeXml(v["#text"]) : "";
    if (!kids.length) return body ? `${pad(depth)}<${tag}${attrs}>${body}</${tag}>` : `${pad(depth)}<${tag}${attrs}/>`;
    return `${pad(depth)}<${tag}${attrs}>${body ? `${body}\n` : "\n"}${kids.map((k) => emit(k, v[k], depth + 1)).join("\n")}\n${pad(depth)}</${tag}>`;
  }
  let body;
  if (isPlain(value) && Object.keys(value).length === 1 && !Object.keys(value)[0].startsWith("@") && !Array.isArray(Object.values(value)[0])) body = emit(Object.keys(value)[0], Object.values(value)[0], 0);
  else if (Array.isArray(value)) body = `<${fixed(root)}>\n${value.map((x) => emit(item, x, 1)).join("\n")}\n</${fixed(root)}>`;
  else body = emit(root, value, 0);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

// ---- structured conversion, with what is lost spelled out ------------------

export const STRUCTURED = ["json", "yaml", "csv", "xml"];

export function convertStructured(text, from, to, { indent = 2, delimiter = ",", header = true, detect = false } = {}) {
  const lossy = [];
  let value;
  if (from === "json") value = parseJsonLoose(text);
  else if (from === "yaml") { value = parseYaml(text); lossy.push("YAML comments are not carried over."); }
  else if (from === "csv") {
    value = csvToRecords(parseCsv(text, delimiter), { header, detect });
    if (!detect) lossy.push("Every CSV value is text, so numbers and true/false become strings. Turn on number detection to change that.");
  } else if (from === "xml") {
    value = parseXml(text);
    lossy.push("XML attributes are stored as @name and text beside child elements as #text; the order of different element names is not kept.");
  } else throw new Error(`Cannot read ${from}.`);
  let out;
  if (to === "json") out = JSON.stringify(value, null, indent || undefined);
  else if (to === "yaml") out = `${toYaml(value)}\n`;
  else if (to === "csv") {
    const rows = recordsToRows(value);
    if (rows.slice(1).some((r) => r.some((c) => c !== null && typeof c === "object"))) lossy.push("Nested lists and records are written as JSON text inside a cell.");
    out = toCsv(rows, delimiter);
  } else if (to === "xml") {
    out = toXml(value, {}, lossy);
    lossy.push("XML has no number, true/false or null types; they are written as text.");
  } else throw new Error(`Cannot write ${to}.`);
  return { text: out, lossy: [...new Set(lossy)] };
}

export function minifyJson(text) {
  return { text: JSON.stringify(parseJsonLoose(text)), lossy: ["Comments and trailing commas, if any, are removed."] };
}

// ---- images: the BMP writer is pure; the rest uses a canvas in the browser

export function encodeBmp(width, height, rgba) {
  const rowSize = width * 4;
  const out = new Uint8Array(54 + rowSize * height);
  const view = new DataView(out.buffer);
  out.set([0x42, 0x4d]);
  view.setUint32(2, out.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(34, rowSize * height, true);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 4;
      const d = 54 + (height - 1 - y) * rowSize + x * 4;
      out[d] = rgba[s + 2];
      out[d + 1] = rgba[s + 1];
      out[d + 2] = rgba[s];
      out[d + 3] = rgba[s + 3];
    }
  }
  return out;
}

export const IMAGE_FORMATS = [
  ["png", "PNG", "image/png", "Lossless; keeps transparency."],
  ["jpeg", "JPEG", "image/jpeg", "Lossy; transparency becomes white."],
  ["webp", "WebP", "image/webp", "Lossy at quality below 100; keeps transparency."],
  ["bmp", "BMP", "image/bmp", "Uncompressed; keeps transparency."],
];

// ---- the catalogue ---------------------------------------------------------

const MISSING = {
  pdf: "A PDF engine that is bundled, proven offline, sandboxed and bounded has not been added yet.",
  audio: "No audio codec is bundled with this app, and the browser does not guarantee encoders offline.",
  video: "No video codec is bundled with this app, and browser video encoders are not guaranteed offline.",
  archive: "Only stored (uncompressed) ZIP files are supported; no compression library is bundled yet.",
};
const structured = [];
for (const a of STRUCTURED) for (const b of STRUCTURED) if (a !== b) structured.push({ id: `${a}-to-${b}`, category: "structured", from: a, to: b, label: `${a.toUpperCase()} to ${b.toUpperCase()}`, available: true });
export const CATALOG = [
  { id: "pdf-to-text", category: "documents", from: "pdf", to: "txt", label: "PDF to text", available: false, missing: MISSING.pdf },
  { id: "text-to-pdf", category: "documents", from: "txt", to: "pdf", label: "Text to PDF", available: false, missing: MISSING.pdf },
  { id: "pdf-merge", category: "documents", from: "pdf", to: "pdf", label: "Merge or split PDF", available: false, missing: MISSING.pdf },
  ...["png", "jpeg", "webp", "bmp"].flatMap((to) => ["png", "jpeg", "webp", "bmp", "gif", "svg"].filter((from) => from !== to).map((from) => ({ id: `${from}-to-${to}`, category: "images", from, to, label: `${from.toUpperCase()} to ${to.toUpperCase()}`, available: true }))),
  { id: "to-gif", category: "images", from: "image", to: "gif", label: "Any image to GIF", available: false, missing: "The browser has no GIF encoder and none is bundled." },
  { id: "audio-convert", category: "audio", from: "wav", to: "mp3", label: "WAV, MP3, OGG, FLAC conversion", available: false, missing: MISSING.audio },
  { id: "video-convert", category: "video", from: "mp4", to: "webm", label: "MP4, WebM conversion", available: false, missing: MISSING.video },
  { id: "files-to-zip", category: "archives", from: "files", to: "zip", label: "Files to ZIP (stored)", available: true },
  { id: "zip-to-files", category: "archives", from: "zip", to: "files", label: "ZIP (stored) to files", available: true },
  { id: "zip-deflate", category: "archives", from: "zip", to: "files", label: "Compressed ZIP, GZIP, 7z, TAR", available: false, missing: MISSING.archive },
  ...structured,
  { id: "json-minify", category: "structured", from: "json", to: "json", label: "Minify JSON", available: true },
  { id: "json-pretty", category: "structured", from: "json", to: "json", label: "Pretty-print JSON", available: true },
  { id: "text-encoding", category: "text", from: "text", to: "text", label: "Text encoding and line endings", available: true },
  { id: "text-to-hex", category: "binary", from: "any", to: "hex", label: "Any file to hex text", available: true },
  { id: "hex-to-file", category: "binary", from: "hex", to: "any", label: "Hex text to file", available: true },
  { id: "text-to-binary", category: "binary", from: "any", to: "bits", label: "Any file to binary text", available: true },
];
export const CATEGORIES = [["structured", "Structured data", "結構化資料"], ["images", "Images", "圖片"], ["text", "Code and text", "程式碼同文字"], ["binary", "Binary encodings", "二進制編碼"], ["archives", "Archives", "壓縮檔"], ["documents", "Documents and PDF", "文件同 PDF"], ["audio", "Audio", "音訊"], ["video", "Video", "影片"]];

// Searches the catalogue by plain text or, when asked, a regular expression.
// A bad pattern reports its problem instead of throwing.
export function searchCatalog(query, { regex = false, flags = "i", list = CATALOG } = {}) {
  const q = query.trim();
  if (!q) return { items: list, error: null };
  let test;
  if (regex) {
    if (q.length > 200) return { items: [], error: "The pattern is longer than 200 characters." };
    try {
      const re = new RegExp(q, flags.replace(/[^imsu]/g, ""));
      test = (s) => re.test(s);
    } catch (error) {
      return { items: [], error: error.message };
    }
  } else test = (s) => s.toLowerCase().includes(q.toLowerCase());
  return { items: list.filter((c) => test(`${c.label} ${c.from} ${c.to} ${c.category}`)), error: null };
}

// ---- the queue: one file at a time, pause, resume, cancel -------------------

// Holds only names and states, never file bytes. run(item) does one file and
// returns a small summary; the queue never keeps what it converted.
export class ConversionQueue {
  constructor(run, { onChange = () => {} } = {}) {
    Object.assign(this, { run, onChange, items: [], paused: false, active: null, nextId: 1, working: false });
  }

  add(file, job) {
    const item = { id: this.nextId++, name: file.name, size: file.size, status: "queued", summary: null, error: null };
    this.items.push({ ...item, file, job });
    this.onChange();
    this.#pump();
    return item.id;
  }

  view() {
    return this.items.map(({ id, name, size, status, summary, error }) => ({ id, name, size, status, summary, error }));
  }

  pause() { this.paused = true; this.onChange(); }
  resume() { this.paused = false; this.onChange(); this.#pump(); }
  cancel(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    if (item.status === "queued") item.status = "cancelled";
    else if (item.status === "running") item.cancelRequested = true;
    this.onChange();
  }
  cancelAll() { this.items.forEach((i) => this.cancel(i.id)); }

  async #pump() {
    if (this.working) return;
    this.working = true;
    try {
      for (;;) {
        if (this.paused) break;
        const item = this.items.find((i) => i.status === "queued");
        if (!item) break;
        item.status = "running";
        this.onChange();
        try {
          const summary = await this.run(item);
          item.status = item.cancelRequested ? "cancelled" : "done";
          item.summary = item.cancelRequested ? null : summary;
        } catch (error) {
          item.status = item.cancelRequested ? "cancelled" : "failed";
          item.error = error.message;
        }
        item.file = null; // the source is released as soon as it is finished
        item.job = null;
        this.onChange();
      }
    } finally {
      this.working = false;
    }
  }

  async idle() {
    while (this.working || (!this.paused && this.items.some((i) => i.status === "queued"))) await new Promise((r) => setTimeout(r, 5));
  }
}

// A name that never replaces an existing one.
export function uniqueName(name, taken) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (taken.has(`${stem} (${n})${ext}`)) n += 1;
  return `${stem} (${n})${ext}`;
}
