const { contextBridge: t, ipcRenderer: i } = require("electron"), a = /* @__PURE__ */ new WeakMap();
t.exposeInMainWorld("ipcRenderer", {
  on(e, o) {
    const n = (r, ...l) => o(r, ...l);
    return a.set(o, n), i.on(e, n);
  },
  off(e, o) {
    const n = a.get(o);
    n && (i.off(e, n), a.delete(o));
  },
  send(...e) {
    const [o, ...n] = e;
    return i.send(o, ...n);
  },
  invoke(...e) {
    const [o, ...n] = e;
    return i.invoke(o, ...n);
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
    const o = (n, r) => e(r);
    return i.on("terminal-output", o), () => i.off("terminal-output", o);
  }
});
