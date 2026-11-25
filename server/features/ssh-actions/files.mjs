// The file browser for the places a person may reasonably work in: /jffs (the
// router's own flash storage), /tmp (memory) and /opt (Entware). Every path is
// checked here before it is quoted into a command, files are only changed
// after a reviewed save, and what is deleted must be typed back.
import { createHash, randomBytes } from "node:crypto";
import { quote } from "../kit.mjs";
import { bad, linesOf } from "./sources.mjs";

export const ROOTS = ["/jffs", "/tmp", "/opt"];
// Places inside those roots that belong to the router itself or to this app.
const DENIED = [/^\/jffs\/\.sys(\/|$)/, /^\/jffs\/nvram(\/|$)/, /^\/tmp\/mar(\/|$)/, /^\/tmp\/etc(\/|$)/];
export const VIEW_LIMIT = 256 * 1024;
export const UPLOAD_LIMIT = 2 * 1024 * 1024;
export const DOWNLOAD_LIMIT = 4 * 1024 * 1024;
// SSH servers accept a command of only about 32 KB, so a file travels in small base64 pieces.
const CHUNK = 16 * 1024;
const REVIEW_MS = 10 * 60 * 1000;

export function cleanPath(value, { root = false } = {}) {
  const text = String(value ?? "").trim();
  if (!/^\/[A-Za-z0-9 ._@+=,:~/-]{0,300}$/.test(text) || text.includes("//")) throw bad("Use a path that starts with /jffs, /tmp or /opt, with plain letters, digits and dots.");
  const parts = text.split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === "..")) throw bad("Paths cannot contain . or .. pieces.");
  const path = `/${parts.join("/")}`;
  const top = ROOTS.find((r) => path === r || path.startsWith(`${r}/`));
  if (!top) throw bad("Only /jffs, /tmp and /opt can be browsed here.", 403);
  if (path === top && !root) throw bad("Choose a file or folder inside it.", 400);
  if (DENIED.some((re) => re.test(path))) throw bad("That place belongs to the router or to this app, so it is not available here.", 403, { code: "PROTECTED_PATH" });
  return path;
}

// The path as the router really resolves it, so a link inside /tmp cannot lead out of the allowed places.
export async function safePath(exec, value, options) {
  const path = cleanPath(value, options);
  const out = await exec(`readlink -f ${quote(path)}`);
  const real = out.code === 0 ? out.stdout.trim() : "";
  if (real && real !== path) {
    try {
      cleanPath(real, { root: true });
    } catch {
      throw bad("That path leads outside the places this screen may use.", 403, { code: "PROTECTED_PATH" });
    }
  }
  return path;
}

const TYPES = { "-": "file", d: "folder", l: "link", c: "device", b: "device", p: "pipe", s: "socket" };
export function parseListing(text) {
  const out = [];
  for (const line of linesOf(text)) {
    const m = line.match(/^([-dlcbps])([rwxsStT-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3}\s+\d+\s+[\d:]+)\s+(.+)$/);
    if (!m) continue;
    const name = m[5].replace(/ -> .*$/, "");
    if (name === "." || name === "..") continue;
    out.push({ name, type: TYPES[m[1]] ?? "file", mode: m[2], size: Number(m[3]), modified: m[4] });
  }
  return out.sort((a, b) => (a.type === "folder") !== (b.type === "folder") ? (a.type === "folder" ? -1 : 1) : a.name.localeCompare(b.name));
}

export async function listFolder(exec, path) {
  const out = await exec(`ls -lA ${quote(path)}`);
  if (out.code !== 0) throw bad("That folder is not on the router.", 404);
  return parseListing(out.stdout);
}

async function sizeOf(exec, path) {
  const out = await exec(`wc -c < ${quote(path)}`);
  const size = Number.parseInt(out.stdout.trim(), 10);
  if (out.code !== 0 || !Number.isInteger(size)) throw bad("That file is not on the router.", 404);
  return size;
}

// Reads a whole file (up to a limit) as exact bytes through base64.
export async function readBytes(exec, path, limit) {
  const size = await sizeOf(exec, path);
  if (size > limit) throw bad(`That file is ${size} bytes, bigger than the ${limit} bytes this screen handles.`, 413, { size });
  const out = await exec(`base64 ${quote(path)}`);
  if (out.code !== 0) throw bad("The router could not read that file.", 502);
  return Buffer.from(out.stdout.replace(/\s+/g, ""), "base64");
}

const isText = (buffer) => !buffer.includes(0) && Buffer.from(buffer.toString("utf8"), "utf8").equals(buffer);

export async function readText(exec, path) {
  const buffer = await readBytes(exec, path, VIEW_LIMIT);
  if (!isText(buffer)) throw bad("That file is not plain text, so it cannot be shown. You can download it instead.", 415, { code: "BINARY" });
  const content = buffer.toString("utf8");
  return { path, size: buffer.length, content, hash: createHash("sha256").update(buffer).digest("hex") };
}

// A small line diff so a person can read what a save would change.
export function lineDiff(before, after, context = 2) {
  const a = before.split("\n");
  const b = after.split("\n");
  if (a.length * b.length > 4_000_000) return { rows: [{ op: "~", text: `Both versions are long (${a.length} and ${b.length} lines); a line by line comparison was skipped.` }], added: Math.max(0, b.length - a.length), removed: Math.max(0, a.length - b.length) };
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const all = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) all.push({ op: " ", text: a[i++] }), j++;
    else if (table[i + 1][j] >= table[i][j + 1]) all.push({ op: "-", text: a[i++] });
    else all.push({ op: "+", text: b[j++] });
  }
  while (i < a.length) all.push({ op: "-", text: a[i++] });
  while (j < b.length) all.push({ op: "+", text: b[j++] });
  const keep = new Set();
  all.forEach((row, index) => {
    if (row.op !== " ") for (let k = Math.max(0, index - context); k <= Math.min(all.length - 1, index + context); k += 1) keep.add(k);
  });
  const rows = [];
  let last = -1;
  all.forEach((row, index) => {
    if (!keep.has(index)) return;
    if (last !== -1 && index > last + 1) rows.push({ op: "~", text: "…" });
    rows.push(row);
    last = index;
  });
  return { rows, added: all.filter((r) => r.op === "+").length, removed: all.filter((r) => r.op === "-").length };
}

const reviews = (app) => (app.fileReviews ??= new Map());

export async function reviewSave(app, exec, { path, content, who }) {
  const text = String(content ?? "");
  if (Buffer.byteLength(text) > VIEW_LIMIT) throw bad("That text is too long to save from this screen.", 413);
  if (text.includes("\0")) throw bad("Text files cannot contain null bytes.");
  let old = "";
  let isNew = false;
  try {
    old = (await readText(exec, path)).content;
  } catch (error) {
    if (error.status !== 404) throw error;
    isNew = true;
  }
  const diff = lineDiff(old, text);
  if (!isNew && diff.added === 0 && diff.removed === 0) throw bad("Nothing would change.", 400);
  const id = randomBytes(9).toString("base64url");
  const now = Date.now();
  for (const [key, value] of reviews(app)) if (value.at + REVIEW_MS < now) reviews(app).delete(key);
  reviews(app).set(id, { path, content: text, oldHash: createHash("sha256").update(old).digest("hex"), isNew, userId: who.userId, at: now });
  return { id, path, isNew, diff };
}

export async function saveReviewed(app, exec, { id, who }) {
  const rec = reviews(app).get(String(id ?? ""));
  if (!rec || rec.userId !== who.userId || rec.at + REVIEW_MS < Date.now()) throw bad("That review expired. Review the change again.", 410);
  reviews(app).delete(id);
  if (!rec.isNew) {
    const now = await readText(exec, rec.path).catch(() => null);
    if (!now || createHash("sha256").update(now.content).digest("hex") !== rec.oldHash) throw bad("The file changed on the router since you reviewed it. Review it again.", 409);
  }
  await writeBytes(exec, rec.path, Buffer.from(rec.content, "utf8"));
  return { path: rec.path, bytes: Buffer.byteLength(rec.content), isNew: rec.isNew };
}

// Writes exact bytes: base64 pieces to a temporary file, decoded and size
// checked there, then copied over the target (which keeps its permissions).
export async function writeBytes(exec, path, buffer, { executable = false } = {}) {
  if (buffer.length > UPLOAD_LIMIT) throw bad(`Files up to ${UPLOAD_LIMIT} bytes can be sent from here.`, 413);
  const id = randomBytes(6).toString("hex");
  const part = `/tmp/mar/up-${id}.b64`;
  const bin = `/tmp/mar/up-${id}.bin`;
  const encoded = buffer.toString("base64");
  const cleanup = () => exec(`rm -f ${part} ${bin}`).catch(() => {});
  try {
    const first = await exec(`mkdir -p /tmp/mar; : > ${part}`);
    if (first.code !== 0) throw bad("The router would not take a temporary file.", 502);
    for (let at = 0; at < encoded.length; at += CHUNK) {
      const out = await exec(`printf '%s' '${encoded.slice(at, at + CHUNK)}' >> ${part}`);
      if (out.code !== 0) throw bad("The router stopped taking the file part way through, so nothing was changed.", 502);
    }
    if ((await exec(`base64 -d ${part} > ${bin}`)).code !== 0) throw bad("The router could not decode the file.", 502);
    const written = Number.parseInt((await exec(`wc -c < ${bin}`)).stdout.trim(), 10);
    if (written !== buffer.length) throw bad("The file did not arrive complete, so nothing was changed.", 502);
    if ((await exec(`cp ${bin} ${quote(path)}`)).code !== 0) throw bad("The router could not write there.", 502);
    if (executable) await exec(`chmod 755 ${quote(path)}`);
  } finally {
    await cleanup();
  }
}

export async function deleteEntry(exec, path, { confirmName }) {
  const name = path.split("/").pop();
  if (confirmName !== name) throw bad(`Type the name, ${name}, exactly to confirm.`, 403, { code: "CONFIRM_NAME" });
  const kind = (await exec(`test -d ${quote(path)} && echo folder || echo file`)).stdout.trim();
  const out = await exec(kind === "folder" ? `rmdir ${quote(path)}` : `rm -f ${quote(path)}`);
  if (out.code !== 0) throw bad(kind === "folder" ? "Only empty folders can be deleted from here." : "The router could not delete that file.", 409);
  return { path, kind };
}

// Under /jffs and /opt a delete cannot be brought back, so it takes a super
// confirmation. In /tmp (memory) typing the name is enough.
export const deleteNeedsSuper = (path) => !path.startsWith("/tmp/");

export function checkUpload(folder, name, size) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,100}$/.test(String(name))) throw bad("Use a plain file name with letters, digits, dots, dashes and spaces.");
  if (!Number.isInteger(size) || size < 0 || size > UPLOAD_LIMIT) throw bad(`Files up to ${UPLOAD_LIMIT} bytes can be uploaded.`, 413);
  return cleanPath(`${folder}/${name}`);
}
