// external-editor is browser-only. This tests its pure link, workspace and
// probe code, and that the module is well formed and served.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DOCKVIEW_NOTE, EDITORS, downloadPage, editorLink, installProbes, normalizePath, workspaceFile, workspaceZip } from "../../public/js/features/external-editor/editor.js";
import { readZip } from "../../public/js/features/external-editor/zip.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/external-editor/index.js";
import { startApp } from "../helpers.mjs";

test("links open a folder as the workspace root, for each editor, on each kind of path", () => {
  assert.equal(editorLink("vscode", "C:\\Users\\Pat\\my router"), "vscode://file/C:/Users/Pat/my%20router");
  assert.equal(editorLink("vscode", "/home/pat/router"), "vscode://file/home/pat/router");
  assert.equal(editorLink("insiders", "D:/Work/a"), "vscode-insiders://file/D:/Work/a");
  assert.equal(editorLink("vscodium", '"C:\\x\\y"'), "vscodium://file/C:/x/y", "surrounding quotes from a paste are removed");
  assert.equal(editorLink("vscode", "/home/pat/a.json", { line: 4, column: 2 }), "vscode://file/home/pat/a.json:4:2");
  assert.equal(normalizePath("/a b/c#d"), "/a%20b/c%23d");
  assert.deepEqual(EDITORS.map(([id]) => id), ["vscode", "insiders", "vscodium"]);
});

test("a bad path or editor is refused with a sentence that says what to fix", () => {
  assert.throws(() => normalizePath(""), /Type the folder/);
  assert.throws(() => normalizePath("relative/path"), /full path/);
  assert.throws(() => normalizePath("C:\\a\\..\\b"), /\.\./);
  assert.throws(() => normalizePath("\\\\nas\\share\\x"), /Network paths/);
  assert.throws(() => normalizePath("/a\nb"), /line break/);
  assert.throws(() => editorLink("notepad", "/x"), /Choose an editor/);
});

test("the workspace ZIP holds the files, a workspace file that roots at the folder, and a README", () => {
  const entries = readZip(workspaceZip([{ name: "router-backup.json", text: '{"a":1}' }, { name: "change-history.json", text: "[]" }]));
  assert.deepEqual(entries.map((e) => e.name), ["router-backup.json", "change-history.json", "router.code-workspace", "README.txt"]);
  const workspace = JSON.parse(new TextDecoder().decode(entries[2].bytes));
  assert.deepEqual(workspace.folders[0], { path: ".", name: "router" });
  assert.equal(new TextDecoder().decode(entries[0].bytes), '{"a":1}');
  assert.match(new TextDecoder().decode(entries[3].bytes), /Open router\.code-workspace/);
  assert.equal(JSON.parse(workspaceFile("x", ["../other"])).folders[1].path, "../other");
  assert.equal(readZip(workspaceZip([{ name: "a.txt", text: "1" }, { name: "a.txt", text: "2" }])).map((e) => e.name).slice(0, 2).join(), "a.txt,a (2).txt", "names never collide");
});

test("the install places a desktop app checks cover per-user, machine, Insiders, VSCodium, portable and PATH installs", () => {
  const probes = installProbes({ LOCALAPPDATA: "C:\\Users\\Pat\\AppData\\Local", ProgramFiles: "C:\\Program Files" });
  assert.deepEqual([...new Set(probes.map((p) => p.kind))].sort(), ["machine", "path", "per-user", "portable"]);
  assert.ok(probes.some((p) => p.path === "C:\\Users\\Pat\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe"));
  assert.ok(probes.some((p) => p.editor === "insiders" && p.kind === "machine"));
  assert.ok(probes.some((p) => p.editor === "vscodium"));
});

test("the download offer points at the official download page and the dockview note stays honest", () => {
  assert.equal(downloadPage(), "https://code.visualstudio.com/download");
  assert.equal(DOCKVIEW_NOTE.required, true);
  assert.equal(DOCKVIEW_NOTE.integrated, false, "dockview is required and not yet integrated");
  assert.match(DOCKVIEW_NOTE.body.en, /private fork/);
  assert.match(DOCKVIEW_NOTE.body.en, /not been integrated/);
  assert.ok(DOCKVIEW_NOTE.body.yue.length > 10);
});

test("the module is well formed, listed in the manifest and served", async () => {
  assert.equal(checkFeatureModule(feature, "external-editor"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/external-editor/index.js"));
    assert.equal((await fetch(`${t.base}/js/features/external-editor/editor.js`)).status, 200);
  } finally {
    await t.stop();
  }
});
