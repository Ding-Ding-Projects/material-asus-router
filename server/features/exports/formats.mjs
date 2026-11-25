// Turns a table (columns plus rows of strings) into each export format, parses
// the formats that can be read back, and says exactly what each one loses.
// Everything is written with plain code: a small PDF writer and a "stored" ZIP
// writer are included, so no library or online service is involved.
import { deflateRawSync } from "node:zlib";

export const FORMATS = ["json", "csv", "yaml", "md", "html", "pdf"];
export const SCHEMA_VERSION = 1;

export const LOSS = {
  json: { en: "Nothing is lost. Every column and value is kept as text.", yue: "冇任何損失，所有欄位同數值都以文字保存。", importable: true },
  csv: { en: "Flat table only: the title and notes are dropped, and a spreadsheet may treat a cell starting with = + - or @ as a formula. Types are text.", yue: "只係平面表格：標題同備註會被略去；試算表可能將以 = + - 或 @ 開頭嘅儲存格當成公式。所有數值係文字。", importable: true },
  yaml: { en: "Nothing is lost. Values are written as quoted text.", yue: "冇任何損失。數值以引號文字寫出。", importable: true },
  md: { en: "A readable table: line breaks inside a value become spaces and the format cannot be imported again.", yue: "易讀表格：數值內嘅換行會變成空格，而且之後唔能再匯入。", importable: false },
  html: { en: "A readable page for printing or sharing: styling only, no scripts, and it cannot be imported again.", yue: "適合列印或分享嘅網頁：只有樣式、冇腳本，之後唔能再匯入。", importable: false },
  pdf: { en: "A printable page of text in a Latin-1 font: characters outside it, such as Cantonese, are replaced by a question mark, and it cannot be imported again. Use JSON for complete text.", yue: "用 Latin-1 字型嘅文字列印頁：範圍以外嘅字（例如廣東話）會變成問號，之後唔能再匯入。要完整文字請用 JSON。", importable: false },
};

const MIME = { json: "application/json", csv: "text/csv", yaml: "application/yaml", md: "text/markdown", html: "text/html", pdf: "application/pdf" };
const cell = (v) => (v === undefined || v === null ? "" : String(v));

export function describe(format) {
  return { format, mime: `${MIME[format]}${format === "pdf" ? "" : "; charset=utf-8"}`, encoding: format === "pdf" ? "binary" : "UTF-8", lineEndings: format === "csv" ? "CRLF" : "LF", schemaVersion: SCHEMA_VERSION, extension: format === "md" ? "md" : format, loss: LOSS[format] };
}

const csvQuote = (v) => `"${cell(v).replace(/"/g, '""')}"`;
const htmlEscape = (v) => cell(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function serialize(format, table) {
  const { title, columns, rows, meta } = table;
  if (format === "json") return JSON.stringify({ format: "material-asus-router-export", schemaVersion: SCHEMA_VERSION, title, meta, columns, rows: rows.map((r) => Object.fromEntries(columns.map((c) => [c, cell(r[c])]))) }, null, 2);
  if (format === "csv") return [columns.map(csvQuote).join(","), ...rows.map((r) => columns.map((c) => csvQuote(r[c])).join(","))].join("\r\n");
  if (format === "yaml") return [`# ${title}`, `schemaVersion: ${SCHEMA_VERSION}`, "rows:", ...(rows.length ? rows.flatMap((r) => columns.map((c, i) => `${i === 0 ? "  - " : "    "}${c}: ${JSON.stringify(cell(r[c]))}`)) : ["  []"])].join("\n");
  if (format === "md") return [`# ${title}`, "", `| ${columns.join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${columns.map((c) => cell(r[c]).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ")).join(" | ")} |`)].join("\n");
  if (format === "html") return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${htmlEscape(title)}</title></head><body><h1>${htmlEscape(title)}</h1><table border="1" cellpadding="4"><thead><tr>${columns.map((c) => `<th>${htmlEscape(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${htmlEscape(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  throw new Error(`Unknown format ${format}.`);
}

// ---- reading back --------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (value += '"'), i++;
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") (row.push(value), (value = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else value += ch;
  }
  if (value !== "" || row.length) (row.push(value), rows.push(row));
  if (quoted) throw new Error("A quoted CSV value was never closed.");
  const [columns, ...rest] = rows;
  if (!columns?.length) throw new Error("The CSV file has no header row.");
  return { columns, rows: rest.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""]))) };
}

function parseYaml(text) {
  const rows = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\s+-\s|\s{4})([^:]+): (".*")\s*$/);
    if (!m) continue;
    if (m[1].includes("-")) rows.push((current = {}));
    if (!current) throw new Error("The YAML file does not match this export's layout.");
    current[m[2]] = JSON.parse(m[3]);
  }
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return { columns, rows };
}

export function parse(format, text) {
  if (!["json", "csv", "yaml"].includes(format)) throw new Error(`${format.toUpperCase()} cannot be imported again. Use JSON, CSV or YAML.`);
  if (format === "csv") return parseCsv(text);
  if (format === "yaml") return parseYaml(text);
  const data = JSON.parse(text);
  if (data?.format !== "material-asus-router-export" || !Array.isArray(data.rows) || !Array.isArray(data.columns)) throw new Error("That is not an export from this app.");
  return { columns: data.columns, rows: data.rows, schemaVersion: data.schemaVersion };
}

// ---- PDF -----------------------------------------------------------------------

const latin = (s) => cell(s).replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const pdfText = (s) => latin(s).replace(/[\\()]/g, "\\$&");

export function pdfFile(title, lines) {
  const perPage = 58;
  const pages = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) pages.push(lines.slice(i, i + perPage));
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  const catalog = add("");
  const tree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  const kids = pages.map((chunk, n) => {
    const stream = ["BT", "/F1 9 Tf", "12 TL", "40 800 Td", `(${pdfText(n === 0 ? title : `${title} (page ${n + 1})`)}) Tj`, "T*", ...chunk.map((l) => `(${pdfText(l.slice(0, 110))}) ' `), "ET"].join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export const tableLines = ({ title, columns, rows }) => {
  const widths = columns.map((c) => Math.min(30, Math.max(c.length, ...rows.map((r) => cell(r[c]).length))));
  const fit = (v, w) => cell(v).replace(/\s+/g, " ").slice(0, w).padEnd(w);
  return [columns.map((c, i) => fit(c, widths[i])).join(" "), ...rows.map((r) => columns.map((c, i) => fit(r[c], widths[i])).join(" "))];
};

// ---- ZIP (entries are stored or deflated, with relative paths only) ---------------

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
export const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const b of buffer) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function zipFile(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    if (/^[/\\]|\.\.|:/.test(name)) throw new Error(`The path ${name} is not a safe relative path.`);
    const raw = Buffer.from(data);
    const packed = deflateRawSync(raw);
    const useDeflate = packed.length < raw.length;
    const body = useDeflate ? packed : raw;
    const nameBytes = Buffer.from(name, "utf8");
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(useDeflate ? 8 : 0, 8);
    header.writeUInt32LE(0x00210000, 10); // fixed date, so the archive is reproducible
    header.writeUInt32LE(crc32(raw), 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    locals.push(header, nameBytes, body);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(useDeflate ? 8 : 0, 10);
    dir.writeUInt32LE(0x00210000, 12);
    dir.writeUInt32LE(crc32(raw), 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBytes);
    offset += header.length + nameBytes.length + body.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}
