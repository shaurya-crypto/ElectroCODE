"use strict";
const electron = require("electron");

const listenerMap = new WeakMap();

electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    const wrapped = (event, ...args) => listener(event, ...args);
    listenerMap.set(listener, wrapped);
    return electron.ipcRenderer.on(channel, wrapped);
  },
  off(channel, listener) {
    const wrapped = listenerMap.get(listener);
    if (wrapped) {
      electron.ipcRenderer.off(channel, wrapped);
      listenerMap.delete(listener);
    }
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});

electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Hardware
  listPorts:      ()     => electron.ipcRenderer.invoke("hardware:listPorts"),
  checkChip:      (args) => electron.ipcRenderer.invoke("hardware:checkChip", args),
  startMonitor:   (args) => electron.ipcRenderer.invoke("hardware:startMonitor", args),
  stopMonitor:    ()     => electron.ipcRenderer.invoke("hardware:stopMonitor"),
  flash:          (args) => electron.ipcRenderer.invoke("hardware:flash", args),

  // Local File System
  openFolder:     ()     => electron.ipcRenderer.invoke("dialog:openFolder"),
  openFile:       ()     => electron.ipcRenderer.invoke("dialog:openFile"),
  saveFile:       (args) => electron.ipcRenderer.invoke("dialog:saveFile", args),
  readDir:        (args) => electron.ipcRenderer.invoke("fs:readDir", args),
  fsReadFile:     (args) => electron.ipcRenderer.invoke("fs:readFile", args),
  createFile:     (args) => electron.ipcRenderer.invoke("fs:createFile", args),
  createFolder:   (args) => electron.ipcRenderer.invoke("fs:createFolder", args),
  fsDelete:       (args) => electron.ipcRenderer.invoke("fs:delete", args),
  fsRename:       (args) => electron.ipcRenderer.invoke("fs:rename", args),

  // API Config
  saveApiSettings: (config) => electron.ipcRenderer.invoke("saveApiSettings", config),

  // Device File System (chip files)
  listFiles:      (args) => electron.ipcRenderer.invoke("hardware:listFiles", args),
  readFile:       (args) => electron.ipcRenderer.invoke("hardware:readFile", args),
  writeFile:      (args) => electron.ipcRenderer.invoke("hardware:writeFile", args),
  deleteFile:     (args) => electron.ipcRenderer.invoke("hardware:deleteFile", args),
  renameFile:     (args) => electron.ipcRenderer.invoke("hardware:renameFile", args),

  // AI
  generateCode:   (args) => electron.ipcRenderer.invoke("ai:generate", args),

  // Terminal output events
  onTerminalOutput: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("terminal-output", handler);
    return () => electron.ipcRenderer.off("terminal-output", handler);
  }
});