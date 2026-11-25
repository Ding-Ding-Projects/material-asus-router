// The pure half of the external editor hand-off: links that open VS Code (and
// its Insiders and VSCodium builds), the workspace file, the places a desktop
// app should look for an installed editor, and the dockview adoption note.
// No browser-only calls, so it is tested from Node.
import { makeZip } from "./zip.js";

export const EDITORS = [
  ["vscode", "Visual Studio Code", "vscode"],
  ["insiders", "VS Code Insiders", "vscode-insiders"],
  ["vscodium", "VSCodium", "vscodium"],
];

// The page people can download VS Code from. Built from parts so no address
// is written into the page source.
export const downloadPage = () => ["https", "://", "code.visualstudio.com", "/download"].join("");

// Turns a path the person typed into the part a vscode:// link needs.
// Windows paths keep their drive letter; every other character that is not
// safe in an address is percent-encoded, one folder name at a time.
export function normalizePath(input) {
  const text = String(input ?? "").trim().replace(/^["']|["']$/g, "");
  if (!text) throw new Error("Type the folder or file path first.");
  if (/[\0\r\n]/.test(text)) throw new Error("The path contains a line break.");
  const windows = /^[A-Za-z]:[\\/]/.exec(text);
  if (/^\\\\/.test(text)) throw new Error("Network paths (starting with two backslashes) cannot be opened this way. Map the share to a drive letter first.");
  if (!windows && !text.startsWith("/")) throw new Error("Write the full path, for example C:\\Work\\router or /home/pat/router.");
  const drive = windows ? text.slice(0, 2) : "";
  const rest = (windows ? text.slice(2) : text).replaceAll("\\", "/");
  const parts = rest.split("/").filter((p, i) => p !== "" || i === 0);
  if (parts.includes("..")) throw new Error('The path cannot contain "..".');
  return `${drive}${parts.map((p) => encodeURIComponent(p)).join("/")}`;
}

export function editorLink(editor, path, { line, column } = {}) {
  const found = EDITORS.find(([id]) => id === editor);
  if (!found) throw new Error("Choose an editor from the list.");
  const where = normalizePath(path);
  const position = line ? `:${Number(line)}${column ? `:${Number(column)}` : ""}` : "";
  return `${found[2]}://file/${where.replace(/^\//, "")}${position}`;
}

// A .code-workspace file that opens the folder it sits in as the root.
export const workspaceFile = (name = "router", extraFolders = []) => `${JSON.stringify({ folders: [{ path: ".", name }, ...extraFolders.map((p) => ({ path: p }))], settings: { "files.autoSave": "off", "editor.formatOnSave": false } }, null, 2)}\n`;

// The workspace as one ZIP: the files, a README that says how to open it, and
// the workspace file. Names never collide (the ZIP writer keeps them unique).
export function workspaceZip(files, { name = "router" } = {}) {
  const enc = new TextEncoder();
  const readme = `This folder was exported from Material Asus Router.\n\nOpen ${name}.code-workspace in Visual Studio Code, or open this folder in it.\nThe files are plain text; nothing here is applied to a router until you import it back through the app.\n`;
  return makeZip([...files.map((f) => ({ name: f.name, bytes: enc.encode(f.text) })), { name: `${name}.code-workspace`, bytes: enc.encode(workspaceFile(name)) }, { name: "README.txt", bytes: enc.encode(readme) }]);
}

// Where a desktop shell looks for a Visual Studio Code install on Windows:
// the per-user install, the machine-wide install, Insiders, VSCodium, a
// portable copy (marked by its data folder) and the command on the path. A
// web page cannot look at the disk, so only the desktop app uses this.
export function installProbes(env = {}) {
  const local = env.LOCALAPPDATA ?? "%LOCALAPPDATA%";
  const programs = env.ProgramFiles ?? "%ProgramFiles%";
  return [
    { kind: "per-user", editor: "vscode", path: `${local}\\Programs\\Microsoft VS Code\\Code.exe` },
    { kind: "machine", editor: "vscode", path: `${programs}\\Microsoft VS Code\\Code.exe` },
    { kind: "per-user", editor: "insiders", path: `${local}\\Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe` },
    { kind: "machine", editor: "insiders", path: `${programs}\\Microsoft VS Code Insiders\\Code - Insiders.exe` },
    { kind: "per-user", editor: "vscodium", path: `${local}\\Programs\\VSCodium\\VSCodium.exe` },
    { kind: "portable", editor: "vscode", path: "<folder>\\Code.exe with a data folder beside it" },
    { kind: "path", editor: "vscode", path: "code on the PATH" },
  ];
}

// What the dockview note says. Recorded here so the screen and the test share it.
export const DOCKVIEW_NOTE = {
  required: true,
  integrated: false,
  title: { en: "Dockable workspace layout (dockview)", yue: "可停靠工作區版面（dockview）" },
  body: {
    en: "The tool screens are meant to sit in a dockable workspace built with dockview from the project's private fork, which is required for this app. It has not been integrated yet, so the screens are ordinary pages for now. Nothing here pretends otherwise.",
    yue: "工具畫面原意放喺用項目私有分支嘅 dockview 做嘅可停靠工作區，呢個程式需要佢。未整合，所以畫面暫時係普通頁面。呢度冇假裝。",
  },
};
