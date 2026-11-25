// Gives the title bar page the few window actions it needs, and nothing else.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
  menu: (x, y) => ipcRenderer.send("window:menu", { x, y }),
  onState: (callback) => ipcRenderer.on("window:state", (_event, state) => callback(state)),
});
