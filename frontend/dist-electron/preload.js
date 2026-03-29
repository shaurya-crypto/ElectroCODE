import { contextBridge, ipcRenderer } from "electron";
const listenerMap = /* @__PURE__ */ new WeakMap();
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    const wrapped = (event, ...args) => listener(event, ...args);
    listenerMap.set(listener, wrapped);
    return ipcRenderer.on(channel, wrapped);
  },
  off(channel, listener) {
    const wrapped = listenerMap.get(listener);
    if (wrapped) {
      ipcRenderer.off(channel, wrapped);
      listenerMap.delete(listener);
    }
  },
  send(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  }
});
contextBridge.exposeInMainWorld("electronAPI", {
  // Hardware
  listPorts: () => ipcRenderer.invoke("hardware:listPorts"),
  checkChip: (args) => ipcRenderer.invoke("hardware:checkChip", args),
  startMonitor: (args) => ipcRenderer.invoke("hardware:startMonitor", args),
  stopMonitor: () => ipcRenderer.invoke("hardware:stopMonitor"),
  flash: (args) => ipcRenderer.invoke("hardware:flash", args),
  // File System
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (args) => ipcRenderer.invoke("dialog:saveFile", args),
  readDir: (args) => ipcRenderer.invoke("fs:readDir", args),
  fsReadFile: (args) => ipcRenderer.invoke("fs:readFile", args),
  createFile: (args) => ipcRenderer.invoke("fs:createFile", args),
  createFolder: (args) => ipcRenderer.invoke("fs:createFolder", args),
  fsDelete: (args) => ipcRenderer.invoke("fs:delete", args),
  fsRename: (args) => ipcRenderer.invoke("fs:rename", args),
  // API Config
  saveApiSettings: (config) => ipcRenderer.invoke("saveApiSettings", config),
  // Device File System (chip files)
  listFiles: (args) => ipcRenderer.invoke("hardware:listFiles", args),
  readFile: (args) => ipcRenderer.invoke("hardware:readFile", args),
  writeFile: (args) => ipcRenderer.invoke("hardware:writeFile", args),
  deleteFile: (args) => ipcRenderer.invoke("hardware:deleteFile", args),
  // AI
  generateCode: (args) => ipcRenderer.invoke("ai:generate", args),
  // Terminal output events
  onTerminalOutput: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("terminal-output", handler);
    return () => ipcRenderer.off("terminal-output", handler);
  }
});
