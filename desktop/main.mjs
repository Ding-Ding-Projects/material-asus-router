// Electron main process: starts the web app in-process, shows it in a window with a
// custom Material title bar, and adds a tray icon, single-instance lock, app menu and
// Squirrel auto-update.
import { app, autoUpdater, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray, WebContentsView } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME, FEED_URL, squirrelEvent, startBackend } from "./backend.mjs";
import { DesktopSettings } from "./settings.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TITLE_BAR = 40;
const DEMO = process.argv.includes("--demo");

app.setName(APP_NAME);
const folder = path.join(app.getPath("appData"), APP_NAME);
app.setPath("userData", folder);
const dataDir = path.join(folder, DEMO ? "data-demo" : "data");
const routerFile = path.join(folder, "router.json");

// ---- Squirrel install, update and uninstall events ---------------------------------
const event = squirrelEvent(process.argv);
if (event && event !== "firstrun") {
  handleSquirrel(event);
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  run();
}

function handleSquirrel(kind) {
  const updater = path.resolve(path.dirname(process.execPath), "..", "Update.exe");
  const exeName = path.basename(process.execPath);
  const call = (...args) => new Promise((resolve) => {
    try {
      spawn(updater, args, { detached: true, stdio: "ignore" }).on("close", resolve).on("error", resolve);
    } catch {
      resolve();
    }
  });
  app.whenReady().then(async () => {
    if (kind === "install" || kind === "updated") await call("--createShortcut", exeName);
    if (kind === "uninstall") await call("--removeShortcut", exeName);
    app.quit();
  });
}

// ---- Normal start ------------------------------------------------------------------
function run() {
  let backend = null;
  let win = null;
  let appView = null;
  let tray = null;
  let quitting = false;
  let settings = null;
  let manualCheck = false;

  const icon = () => nativeImage.createFromPath(path.join(HERE, "assets", "icon.png"));

  app.on("second-instance", () => showWindow());
  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { if (quitting || !settings?.get("keepInTray")) app.quit(); });

  app.whenReady().then(async () => {
    settings = await new DesktopSettings(path.join(folder, "desktop.json")).load();
    try {
      backend = await startBackend({ dataDir, routerFile, demo: DEMO });
    } catch (error) {
      dialog.showErrorBox(APP_NAME, `The app could not start its built-in server.\n\n${error.message}`);
      app.exit(1);
      return;
    }
    createWindow();
    createTray();
    Menu.setApplicationMenu(buildMenu());
    setupUpdates();
  });

  app.on("will-quit", () => { backend?.close().catch(() => {}); });

  function createWindow() {
    const saved = settings.get("windowBounds");
    win = new BrowserWindow({
      width: 1280, height: 820, minWidth: 360, minHeight: 480, ...(saved ?? {}),
      frame: false, show: false, title: APP_NAME, icon: icon(), backgroundColor: "#f3edf7",
      webPreferences: { preload: path.join(HERE, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    if (settings.get("maximized")) win.maximize();
    win.loadFile(path.join(HERE, "shell.html"));

    appView = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
    win.contentView.addChildView(appView);
    const origin = new URL(backend.url).origin;
    appView.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    appView.webContents.on("will-navigate", (e, url) => {
      if (new URL(url).origin !== origin) {
        e.preventDefault();
        if (/^https?:\/\//.test(url)) shell.openExternal(url);
      }
    });
    appView.webContents.loadURL(backend.url);

    const layout = () => {
      const [width, height] = win.getContentSize();
      appView.setBounds({ x: 0, y: TITLE_BAR, width, height: Math.max(0, height - TITLE_BAR) });
    };
    const sendState = () => win.webContents.send("window:state", { maximized: win.isMaximized() });
    win.on("resize", layout);
    win.on("maximize", () => { layout(); sendState(); });
    win.on("unmaximize", () => { layout(); sendState(); });
    win.webContents.on("did-finish-load", sendState);
    win.once("ready-to-show", () => { layout(); win.show(); });
    win.on("close", (e) => {
      saveBounds();
      if (!quitting && settings.get("keepInTray")) {
        e.preventDefault();
        win.hide();
      }
    });
    win.on("closed", () => { win = null; appView = null; });
  }

  function saveBounds() {
    if (!win || win.isDestroyed()) return;
    settings.set("maximized", win.isMaximized()).catch(() => {});
    if (!win.isMaximized() && !win.isMinimized()) settings.set("windowBounds", win.getBounds()).catch(() => {});
  }

  function showWindow() {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  function createTray() {
    tray = new Tray(icon().resize({ width: 16, height: 16 }));
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open Material Asus Router", click: showWindow },
      { label: "Check for updates", click: () => checkForUpdates(true) },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]));
    tray.on("click", showWindow);
  }

  function buildMenu() {
    return Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          { label: "Open in browser", click: () => shell.openExternal(backend.url) },
          { label: "Keep running in the tray when closed", type: "checkbox", checked: settings.get("keepInTray"), click: (item) => settings.set("keepInTray", item.checked) },
          { type: "separator" },
          { label: "Open data folder", click: () => shell.openPath(folder) },
          { type: "separator" },
          { label: "Quit", accelerator: "Ctrl+Q", click: () => app.quit() },
        ],
      },
      {
        label: "View",
        submenu: [
          { label: "Reload", accelerator: "Ctrl+R", click: () => appView?.webContents.reload() },
          { type: "separator" },
          { label: "Zoom in", accelerator: "Ctrl+=", click: () => zoom(0.5) },
          { label: "Zoom out", accelerator: "Ctrl+-", click: () => zoom(-0.5) },
          { label: "Actual size", accelerator: "Ctrl+0", click: () => appView?.webContents.setZoomLevel(0) },
          { type: "separator" },
          { label: "Full screen", accelerator: "F11", click: () => win?.setFullScreen(!win.isFullScreen()) },
          ...(app.isPackaged ? [] : [{ label: "Developer tools", accelerator: "Ctrl+Shift+I", click: () => appView?.webContents.openDevTools({ mode: "detach" }) }]),
        ],
      },
      {
        label: "Help",
        submenu: [
          { label: "Documentation", click: () => shell.openExternal("https://ding-ding-projects.github.io/material-asus-router/") },
          { label: "Check for updates", click: () => checkForUpdates(true) },
          { label: `About (version ${app.getVersion()})`, click: showAbout },
        ],
      },
    ]);
  }

  function zoom(delta) {
    if (appView) appView.webContents.setZoomLevel(appView.webContents.getZoomLevel() + delta);
  }

  function showAbout() {
    dialog.showMessageBox(win ?? undefined, {
      type: "info", title: APP_NAME, message: `${APP_NAME} ${app.getVersion()}`,
      detail: `Local address: ${backend.url}\nData folder: ${folder}${DEMO ? "\nDemo mode: a pretend router is in use." : ""}`,
    });
  }

  ipcMain.on("window:minimize", (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on("window:toggle-maximize", (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) (w.isMaximized() ? w.unmaximize() : w.maximize());
  });
  ipcMain.on("window:close", (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.on("window:menu", (e, { x, y }) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) Menu.getApplicationMenu()?.popup({ window: w, x: Math.round(x), y: Math.round(y) });
  });

  // ---- Updates --------------------------------------------------------------------
  // Squirrel needs Update.exe next to the app folder, so only installed copies update.
  // The portable .exe and a development run say so instead of failing quietly.
  function canUpdate() {
    return process.platform === "win32" && app.isPackaged && existsSync(path.resolve(path.dirname(process.execPath), "..", "Update.exe"));
  }

  function setupUpdates() {
    if (!canUpdate()) return;
    autoUpdater.setFeedURL({ url: FEED_URL });
    autoUpdater.on("update-available", () => { if (manualCheck) dialog.showMessageBox({ message: "An update is available and is downloading now." }); });
    autoUpdater.on("update-not-available", () => { if (manualCheck) dialog.showMessageBox({ message: `${APP_NAME} is up to date.` }); manualCheck = false; });
    autoUpdater.on("error", (error) => { if (manualCheck) dialog.showErrorBox(APP_NAME, `The update check failed.\n\n${error.message}`); manualCheck = false; });
    autoUpdater.on("update-downloaded", async (_e, notes, name) => {
      manualCheck = false;
      const { response } = await dialog.showMessageBox(win ?? undefined, {
        type: "info", buttons: ["Restart now", "Later"], defaultId: 0, cancelId: 1,
        message: `Version ${name || "update"} is ready.`, detail: "Restart to finish updating. Your settings and data are kept.",
      });
      if (response === 0) { quitting = true; autoUpdater.quitAndInstall(); }
    });
    setTimeout(() => checkForUpdates(false), 15000);
    setInterval(() => checkForUpdates(false), 6 * 60 * 60 * 1000);
  }

  function checkForUpdates(manual) {
    if (!canUpdate()) {
      if (manual) dialog.showMessageBox(win ?? undefined, { message: "Updates work for the installed version. This copy (portable or development) does not update itself; download a newer build from the releases page.", buttons: ["OK", "Open releases page"], cancelId: 0 }).then(({ response }) => { if (response === 1) shell.openExternal("https://github.com/Ding-Ding-Projects/material-asus-router/releases/latest"); });
      return;
    }
    manualCheck = manual;
    try { autoUpdater.checkForUpdates(); } catch (error) { if (manual) dialog.showErrorBox(APP_NAME, error.message); }
  }
}
