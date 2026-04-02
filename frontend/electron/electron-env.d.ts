/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer

  electronAPI: {
    // Hardware
    listPorts:    () => Promise<Array<{ path: string; description?: string; manufacturer?: string }>>
    checkChip:    (args: { port: string }) => Promise<{ connected: boolean; message?: string }>
    startMonitor: (args: { port: string; baudRate?: number }) => Promise<{ success: boolean; message?: string }>
    stopMonitor:  () => Promise<{ success: boolean }>
    flash:        (args: { code: string; port: string; language: string; boardId?: string; deviceName?: string }) => Promise<{ success: boolean; message: string }>

    // File System
    listFiles:    (args: { port: string }) => Promise<unknown>
    readFile:     (args: { port: string; filePath: string }) => Promise<{ content: string; error?: string }>
    writeFile:    (args: { port: string; filePath: string; content: string }) => Promise<{ success: boolean; message?: string }>
    deleteFile:   (args: { port: string; filePath: string }) => Promise<{ success: boolean; message?: string }>
    renameFile:   (args: { port: string; oldPath: string; newPath: string }) => Promise<{ success: boolean; message?: string }>
    openFolder:   () => Promise<string | null>

    // AI
    generateCode: (args: { prompt: string; deviceProfile?: unknown }) => Promise<{ code: string; wiring: string }>

    // Terminal output events
    onTerminalOutput: (cb: (data: string) => void) => () => void
  }
}

