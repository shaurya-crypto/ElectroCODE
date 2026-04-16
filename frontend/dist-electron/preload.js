const { contextBridge: t, ipcRenderer: i } = require("electron"), a = /* @__PURE__ */ new WeakMap();
t.exposeInMainWorld("ipcRenderer", {
  on(e, n) {
    const o = (r, ...l) => n(r, ...l);
    return a.set(n, o), i.on(e, o);
  },
  off(e, n) {
    const o = a.get(n);
    o && (i.off(e, o), a.delete(n));
  },
  send(...e) {
    const [n, ...o] = e;
    return i.send(n, ...o);
  },
  invoke(...e) {
    const [n, ...o] = e;
    return i.invoke(n, ...o);
  }
});
t.exposeInMainWorld("electronAPI", {
  // Hardware
  listPorts: () => i.invoke("hardware:listPorts"),
  checkChip: (e) => i.invoke("hardware:checkChip", e),
  startMonitor: (e) => i.invoke("hardware:startMonitor", e),
  stopMonitor: () => i.invoke("hardware:stopMonitor"),
  stopExecution: (e) => i.invoke("hardware:stopExecution", e),
  flash: (e) => i.invoke("hardware:flash", e),
  // File System
  openFolder: () => i.invoke("dialog:openFolder"),
  openFile: () => i.invoke("dialog:openFile"),
  saveFile: (e) => i.invoke("dialog:saveFile", e),
  readDir: (e) => i.invoke("fs:readDir", e),
  fsReadFile: (e) => i.invoke("fs:readFile", e),
  createFile: (e) => i.invoke("fs:createFile", e),
  createFolder: (e) => i.invoke("fs:createFolder", e),
  fsDelete: (e) => i.invoke("fs:delete", e),
  fsRename: (e) => i.invoke("fs:rename", e),
  // API Config
  saveApiSettings: (e) => i.invoke("saveApiSettings", e),
  loadApiSettings: () => i.invoke("loadApiSettings"),
  // Device File System (chip files)
  listFiles: (e) => i.invoke("hardware:listFiles", e),
  readFile: (e) => i.invoke("hardware:readFile", e),
  writeFile: (e) => i.invoke("hardware:writeFile", e),
  deleteFile: (e) => i.invoke("hardware:deleteFile", e),
  renameFile: (e) => i.invoke("hardware:renameFile", e),
  // AI
  generateCode: (e) => i.invoke("ai:generate", e),
  // Window Controls
  minimize: () => i.invoke("window:minimize"),
  maximize: () => i.invoke("window:maximize"),
  close: () => i.invoke("window:close"),
  // Terminal output events
  onTerminalOutput: (e) => {
    const n = (o, r) => e(r);
    return i.on("terminal-output", n), () => i.off("terminal-output", n);
  },
  // Terminal REPL input — send keystrokes to device
  sendTerminalInput: (e) => i.invoke("terminal:sendInput", e),
  // Firmware installation
  listVolumes: () => i.invoke("firmware:listVolumes"),
  installFirmware: (e) => i.invoke("firmware:install", e),
  downloadFirmware: (e) => i.invoke("firmware:download", e),
  onFirmwareProgress: (e) => {
    const n = (o, r) => e(r);
    return i.on("firmware-progress", n), () => i.off("firmware-progress", n);
  },
  // Shell
  openExternal: (e) => i.invoke("shell:openExternal", e)
});
