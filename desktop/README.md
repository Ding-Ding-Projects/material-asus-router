# Material Asus Router for Windows

The desktop app wraps the same web app that the Docker version serves. On start it runs the
server in-process on a random loopback port (127.0.0.1 only), waits for `/health`, and opens it in
a window with a Material title bar. Nothing listens on the network.

## What it does

- Keeps its data in `%APPDATA%\Material Asus Router\data` (the Docker version uses `/data`).
- Single instance: starting it again brings the existing window forward.
- Tray icon with Open, Check for updates and Quit. The File menu has "Keep running in the tray when closed" (off by default).
- Menu button in the title bar (or F10): open in browser, data folder, zoom, full screen, updates, about.
- `--demo` starts a pretend router and a separate data folder (`data-demo`), so you can try everything without a real router.
- Prefills the router address and user from `%APPDATA%\Material Asus Router\router.json` when that file exists and no router is saved yet:

  ```json
  { "host": "198.51.100.1", "port": 22, "username": "Pat" }
  ```

  The file stays on your computer and is never committed. A `password` field is accepted and moved into the app's encrypted vault; you still approve the router's host key in the app.
- Installed copies check for updates every six hours (Squirrel feed from the latest GitHub release) and ask before restarting. The portable `.exe` does not update itself.

## Build it

Run these from the repository root on Windows. Both are detect-first: Node.js 22 or newer is used if present, otherwise Chocolatey (installed from its official script if missing) installs it after one Windows administrator prompt that you approve.

| Command | Result |
| --- | --- |
| `build.bat` | install packages, run the tests, build `desktop\dist\builder\win-unpacked\Material Asus Router.exe` |
| `build.bat -Run` | the same, then start the app |
| `build-installer.bat` | the build plus `desktop\dist\squirrel\Material-Asus-Router-Setup.exe`, `RELEASES`, the `.nupkg` and `desktop\dist\builder\Material-Asus-Router-<version>-portable.exe` |
| `download-dependencies.bat` | only install the packages |

Both exit with a nonzero code on any failure. The installers are not signed, so Windows shows an unknown publisher warning.

During development run `cd desktop && npm ci && npm start` (add `-- --demo` for the pretend router).

## Layout

- `main.mjs` the Electron main process, `backend.mjs` the in-process server start (no Electron, covered by `tests/desktop.test.mjs`).
- `shell.html`, `shell.css`, `shell.js`, `preload.cjs` the custom title bar.
- `scripts/stage.mjs` copies the server, pages and production packages into `payload/`; `scripts/squirrel.mjs` builds the Squirrel files; `scripts/make-icons.mjs` redraws `assets/`.
- Releases are built by `.github/workflows/release.yml` on every push and published as normal releases with tag `v<version>-<run number>`.
