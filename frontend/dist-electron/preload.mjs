"use strict";
const electron = require("electron");

electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    const wrapped = (event, ...args) => listener(event, ...args);
    return electron.ipcRenderer.on(channel, wrapped);
  },
  off(channel, listener) {
    return electron.ipcRenderer.off(channel, listener);
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
  saveFile:       (args) => electron.ipcRenderer.invoke("dialog:saveFile", args),
  readDir:        (args) => electron.ipcRenderer.invoke("fs:readDir", args),
  fsReadFile:     (args) => electron.ipcRenderer.invoke("fs:readFile", args),
  createFile:     (args) => electron.ipcRenderer.invoke("fs:createFile", args),
  createFolder:   (args) => electron.ipcRenderer.invoke("fs:createFolder", args),

  // Device File System
  listFiles:      (args) => electron.ipcRenderer.invoke("hardware:listFiles", args),
  readFile: (args) => electron.ipcRenderer.invoke("hardware:readFile", args),
  writeFile:      (args) => electron.ipcRenderer.invoke("hardware:writeFile", args),

  // AI
  generateCode:   (args) => electron.ipcRenderer.invoke("ai:generate", args),

  // Terminal
  onTerminalOutput: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("terminal-output", handler);
    return () => electron.ipcRenderer.off("terminal-output", handler);
  }
});