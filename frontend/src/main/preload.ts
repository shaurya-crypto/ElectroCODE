const { contextBridge, ipcRenderer } = require("electron");

const listenerMap = new WeakMap<Function, any>();

// --------- Expose ipcRenderer to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel: string, listener: (...args: any[]) => void) {
    const wrapped = (event: any, ...args: any[]) => listener(event, ...args);
    listenerMap.set(listener, wrapped);
    return ipcRenderer.on(channel, wrapped);
  },
  off(channel: string, listener: (...args: any[]) => void) {
    const wrapped = listenerMap.get(listener);
    if (wrapped) {
      ipcRenderer.off(channel, wrapped);
      listenerMap.delete(listener);
    }
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});

// --------- Expose electronAPI (named methods used by the frontend) ---------
contextBridge.exposeInMainWorld("electronAPI", {
  // Hardware
  listPorts: () => ipcRenderer.invoke("hardware:listPorts"),
  checkChip: (args: any) => ipcRenderer.invoke("hardware:checkChip", args),
  startMonitor: (args: any) =>
    ipcRenderer.invoke("hardware:startMonitor", args),
  stopMonitor: () => ipcRenderer.invoke("hardware:stopMonitor"),
  stopExecution: (args: any) => ipcRenderer.invoke("hardware:stopExecution", args),
  flash: (args: any) => ipcRenderer.invoke("hardware:flash", args),

  // File System
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (args: any) => ipcRenderer.invoke("dialog:saveFile", args), 
  readDir: (args: any) => ipcRenderer.invoke("fs:readDir", args),
  fsReadFile: (args: any) => ipcRenderer.invoke("fs:readFile", args), 
  createFile: (args: any) => ipcRenderer.invoke("fs:createFile", args),
  createFolder: (args: any) => ipcRenderer.invoke("fs:createFolder", args),
  fsDelete: (args: any) => ipcRenderer.invoke("fs:delete", args),
  fsRename: (args: any) => ipcRenderer.invoke("fs:rename", args),

  // API Config
  saveApiSettings: (config: any) => ipcRenderer.invoke("saveApiSettings", config),

  // Device File System (chip files)
  listFiles: (args: any) => ipcRenderer.invoke("hardware:listFiles", args),
  readFile: (args: any) => ipcRenderer.invoke("hardware:readFile", args), 
  writeFile: (args: any) => ipcRenderer.invoke("hardware:writeFile", args),
  deleteFile: (args: any) => ipcRenderer.invoke("hardware:deleteFile", args),
  renameFile: (args: any) => ipcRenderer.invoke("hardware:renameFile", args),

  // AI
  generateCode: (args: any) => ipcRenderer.invoke("ai:generate", args),

  // Window Controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),

  // Terminal output events
  onTerminalOutput: (cb: (data: string) => void) => {
    const handler = (_: any, data: string) => cb(data);
    ipcRenderer.on("terminal-output", handler);
    return () => ipcRenderer.off("terminal-output", handler);
  },
});
