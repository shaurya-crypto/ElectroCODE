import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, spawn, execFile, ChildProcess } from "node:child_process";
import fs from "node:fs"; // <-- ADD THIS
import os from "node:os"; // <-- ADD THIS

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- VITE & PATH SETUP (Do not touch) ---
process.env.APP_ROOT = path.join(__dirname, "..");
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let monitorProcess: ChildProcess | null = null; // Keeps track of the live serial monitor
let currentFlashProcess: ChildProcess | null = null;

/**
 * 🔒 HARDWARE MUTEX (The Queue)
 * This ensures that NO TWO hardware operations hit the COM port at the same time.
 * Even if the frontend sends 10 requests, they will wait in a single-file line.
 */
let hardwareMutex = Promise.resolve<any>(null);

function getPythonExe(): string {
  // Check Thonny Python as fallback since Windows Appalias can cause 'python' command to fail
  const thonnyPath = path.join(os.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
  if (fs.existsSync(thonnyPath)) {
    return thonnyPath;
  }
  return "python";
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"), // Vite compiles preload.ts to .mjs
      contextIsolation: true, // Security requirement
      nodeIntegration: false,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// --- IPC LISTENERS (The Backend Logic) ---

async function stopMonitorNative() : Promise<boolean> {
  // 1. Kill any active flash/upload process first
  if (currentFlashProcess) {
    try {
      // 💥 Triple-tap: Send two Ctrl+C (interrupts) and one Ctrl+D (soft reset)
      // to ensure the device actually stops even if caught in a tight loop.
      currentFlashProcess.stdin?.write("\x03\x03\x04"); 
      currentFlashProcess.kill("SIGKILL");
    } catch(e) {}
    currentFlashProcess = null;
  }

  // 2. Stop the monitor process
  return new Promise((resolve) => {
    if (!monitorProcess) return resolve(true);

    const proc = monitorProcess;
    monitorProcess = null;

    let finished = false;
    const done = () => {
      if (!finished) {
        finished = true;
        resolve(true);
      }
    };

    // Listen for completion
    proc.once("close", done);
    proc.once("exit", done);
    proc.once("error", done);

    try {
      // 🟢 Graceful stop (best for serial)
      if (proc.stdin) {
        proc.stdin.write("\x03\x03\x04"); // Interupts + Reset
      }
      proc.kill("SIGINT");
    } catch { }

    // ⏱ Force kill if it hangs
    setTimeout(() => { 
      if (!finished) {
        try { proc.kill("SIGTERM"); } catch(e) {}
      }
    }, 500);

    setTimeout(() => { 
      if (!finished) { 
        try { proc.kill("SIGKILL"); } catch(e) {}
        
        // ⚔️ Windows Aggressive: Kill all residual python monitor handles if still stuck
        if (process.platform === 'win32') {
           exec('taskkill /F /IM python.exe /T', () => done());
        } else {
           done(); 
        }
      } 
    }, 1500);
  });
}

// Helper: run a device operation with guaranteed port access
async function withPortAccess<T>(port: string, operation: () => Promise<T>, retries = 3): Promise<T> {
  // 🔗 Enter the Queue
  const result = await (hardwareMutex = hardwareMutex.then(async () => {
    console.log(`[ElectroAI] Queueing port access for ${port}...`);
    
    // 🛡️ CRITICAL SAFETY: If a flash or run is currently in progress, ABORT other hardware tasks.
    if (currentFlashProcess) {
      console.warn("[ElectroAI] Hardware is currently BUSY with a flash/run process. Aborting request.");
      return { error: "Device is busy performing another action (Flash/Run). Please wait." } as any;
    }

    try {
      await stopMonitorNative();
      // ⏳ Windows Port Cooldown
      await new Promise(r => setTimeout(r, 400)); // Slightly longer for safety
      
      const res = await operation();
      
      // If result indicates failure due to port, throw to trigger retry (handled outside mutex chain)
      if (res && (res as any).error && typeof (res as any).error === 'string' && (res as any).error.toLowerCase().includes('access is denied')) {
         throw new Error('port_busy');
      }
      
      return res;
    } catch (err: any) {
      if (err.message === 'port_busy') throw err; // propagate to retry logic
      return { error: err.message || "Unknown hardware error" } as any;
    }
  }).catch(async (err) => {
     // If it was a 'port_busy' error, we handle it in the retry block below.
     if (err && err.message === 'port_busy') return { _retry: true };
     return { error: err ? err.message : "Lock error" };
  }));

  if (result && (result as any)._retry && retries > 0) {
    console.warn(`[ElectroAI] Port ${port} busy, retrying in 1000ms...`);
    await new Promise(r => setTimeout(r, 1000));
    return withPortAccess(port, operation, retries - 1);
  }

  return result;
}

function setupIpcHandlers() {
  const projectRoot = path.join(process.env.APP_ROOT!, "..");

  // 1. File System - Open Folder Dialog
  ipcMain.handle("dialog:openFolder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (!canceled) {
      return filePaths[0];
    }
    return null;
  });

  ipcMain.handle("dialog:openFile", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Code Files", extensions: ["py", "js", "ts", "json", "html", "css", "md", "txt", "c", "cpp", "h", "hpp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (!canceled && filePaths.length > 0) {
      try {
        const filePath = filePaths[0];
        const content = fs.readFileSync(filePath, "utf-8");
        return {
          path: filePath,
          name: path.basename(filePath),
          content: content
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }
    return null;
  });

  ipcMain.handle("fs:readDir", async (_event, { dirPath }) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) return [];

      const children = fs.readdirSync(dirPath).map((child) => {
        const fullPath = path.join(dirPath, child);
        let isDir = false;
        try {
          isDir = fs.statSync(fullPath).isDirectory();
        } catch (e) { }
        return {
          id: fullPath,
          name: child,
          type: isDir ? "folder" : "file",
          filePath: fullPath,
          children: isDir ? [] : undefined, // Empty array signifies an unloaded folder
        };
      });

      // Sort folders first, then files alphabetically
      return children.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "folder" ? -1 : 1;
      });
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle("fs:readFile", async (_event, { filePath }) => {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle("fs:createFile", async (_event, { filePath, content = "" }) => {
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:createFolder", async (_event, { folderPath }) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:delete", async (_event, { filePath }) => {
    try {
      fs.rmSync(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:rename", async (_event, { oldPath, newPath }) => {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  // API Config / .env Sync
  ipcMain.handle("saveApiSettings", async (_event, config) => {
    try {
      const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
      const electroDir = path.join(LOCAL_APP_DATA, "ElectroAI");
      if (!fs.existsSync(electroDir)) {
        fs.mkdirSync(electroDir, { recursive: true });
      }

      const envPath = path.join(electroDir, ".env");
      let envContent = `ACTIVE_PROVIDER=${config.provider || 'anthropic'}\n` +
        `API_KEY=${config.apiKey || ''}\n` +
        `MODEL=${config.model || ''}\n`;

      fs.writeFileSync(envPath, envContent, "utf-8");
      return { success: true, path: envPath };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  // Scan real ports
  ipcMain.handle("hardware:listPorts", async () => {
    return new Promise((resolve) => {
      console.log("[ElectroAI] Scanning serial ports...");
      exec(
        `"${getPythonExe()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
        { timeout: 10000 },
        (err, stdout, stderr) => {
          if (err) {
            console.error("[ElectroAI] Port scan failed:", err.message);
            if (stderr) console.error("[ElectroAI] stderr:", stderr);
            resolve([]);
            return;
          }
          try {
            const ports = JSON.parse(stdout.trim());
            console.log("[ElectroAI] Found ports:", ports);
            resolve(ports);
          } catch {
            console.error(
              "[ElectroAI] Could not parse port list. stdout:",
              stdout,
            );
            resolve([]);
          }
        },
      );
    });
  });

  // Check chip is actually connected
  ipcMain.handle("hardware:checkChip", async (_, { port }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const ser = spawn(getPythonExe(), [
          "-c",
          `
import serial, sys, time
try:
    s = serial.Serial('${port}', 115200, timeout=1)
    time.sleep(0.2)
    s.close()
    print('ok')
    sys.stdout.flush()
except Exception as e:
    print('fail:' + str(e), file=sys.stderr)
    sys.stderr.flush()
    sys.exit(1)
`,
        ]);

        let out = "";
        let errBuf = "";
        ser.stdout.on("data", (d) => (out += d.toString()));
        ser.stderr.on("data", (d) => (errBuf += d.toString()));

        ser.on("error", (e) => {
          resolve({ connected: false, message: `Python error: ${e.message}` });
        });

        ser.on("close", () => {
          if (out.trim() === "ok") {
            resolve({ connected: true });
          } else {
            const msg = errBuf.trim() || `Access Denied or Port Busy on ${port}.`;
            resolve({ connected: false, message: msg });
          }
        });

        setTimeout(() => { ser.kill(); resolve({ connected: false, message: "Timeout" }); }, 5000);
      });
    });
  });

  ipcMain.handle("dialog:saveFile", async (_, { content, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName ?? "untitled.py",
      filters: [
        { name: "Python", extensions: ["py"] },
        { name: "C/C++", extensions: ["c", "cpp", "ino", "h"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) return { success: false };
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return { success: true, filePath, path: filePath };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle(
    "hardware:flash",
    async (_event, { code, port, language, boardId, deviceName, mode = 'flash' }) => {
      // 🔗 Enter the Queue
      return hardwareMutex = hardwareMutex.then(async () => {
        console.log(`[ElectroAI] Queueing Flash/Run for ${port}...`);

        // 1. Must cleanly stop monitor and send Ctrl+C to halt running scripts before flash!
        await stopMonitorNative();

        return new Promise((resolve) => {
          const tempFilePath = path.join(os.tmpdir(), `electro_temp_${Date.now()}.py`);
          const cleanCode = code.replace(/\r\n/g, "\n");
          try {
            fs.writeFileSync(tempFilePath, cleanCode, "utf-8");
          } catch {
            return resolve({ success: false, message: "Failed to write temp file" });
          }

          // Wait for Windows to release COM port lock
          setTimeout(() => {
            const scriptPath = path.join(
              path.join(process.env.APP_ROOT!, ".."),
              "firmware-tools",
              "core",
              "uploader.py",
            );

            const args = [
              scriptPath,
              "--port",
              port,
              "--file",
              tempFilePath,
              "--language",
              language,
              "--board-id",
              boardId ?? "arduino:avr:uno",
              "--mode",
              mode
            ];

            if (deviceName) {
              args.push("--device-name", deviceName);
            }

            const flashProc = spawn(getPythonExe(), args);
            currentFlashProcess = flashProc;

            let fullOutput = "";

            flashProc.stdout.on("data", (data) => {
              const str = data.toString();
              fullOutput += str;
              win?.webContents.send("terminal-output", str);
            });

            flashProc.stderr.on("data", (data) => {
              const str = data.toString();
              fullOutput += str;
              win?.webContents.send("terminal-output", str);
            });

            flashProc.on("close", (code) => {
              currentFlashProcess = null;
              try { fs.unlinkSync(tempFilePath); } catch(e) {}

              if (code !== 0) {
                const msg = fullOutput.trim() || "Process exited with error";
                resolve({ 
                  success: false, 
                  message: msg.includes("ERROR:") ? msg.split("ERROR:")[1].trim() : msg 
                });
              } else {
                resolve({ success: true, message: "Success" });
              }
            });

            flashProc.on("error", (err) => {
              currentFlashProcess = null;
              try { fs.unlinkSync(tempFilePath); } catch(e) {}
              resolve({ success: false, message: err.message });
            });

          }, 400); // ⏱ Wait for OS cleanup
        });
      }).catch(err => {
         return { success: false, message: err.message || "Queue Error" };
      });
    }
  );

  // 4. Hardware - Start Live Serial Monitor
  ipcMain.handle(
    "hardware:startMonitor",
    async (_event, { port, baudRate = 115200 }) => {
      if (monitorProcess)
        return { success: false, message: "Monitor already running" };

      const scriptPath = path.join(
        projectRoot,
        "firmware-tools",
        "serial",
        "monitor.py",
      );

      // Use spawn() instead of exec() so we can stream the data continuously
      monitorProcess = spawn(getPythonExe(), [
        scriptPath,
        "--port",
        port,
        "--baud",
        baudRate.toString(),
      ]);

      // Listen to every print() statement from the Pico and send it to React
      monitorProcess.stdout?.on("data", (data) => {
        if (win) {
          win.webContents.send("terminal-output", data.toString().trim());
        }
      });

      monitorProcess.stderr?.on("data", (data) => {
        console.error(`Monitor Error: ${data}`);
      });

      monitorProcess.on("close", () => {
        monitorProcess = null;
      });

      return { success: true };
    },
  );

  // 5. Hardware - Stop Live Serial Monitor and Execution
  ipcMain.handle("hardware:stopMonitor", async () => {
    await stopMonitorNative();
    return { success: true };
  });

  // 6. Hardware - Device File System (List Files)
  ipcMain.handle("hardware:listFiles", async (_event, { port }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py",
        );

        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action list`,
          { timeout: 30000 },
          (error, stdout) => {
            if (error) {
              console.error('[ElectroAI] listFiles error:', error.message);
              resolve({ error: "Failed to read device" });
              return;
            }
            try {
              const files = JSON.parse(stdout.trim());
              resolve(files);
            } catch (e) {
              console.error('[ElectroAI] listFiles parse error:', stdout);
              resolve({ error: "Invalid data from device" });
            }
          },
        );
      });
    });
  });

  // 7. Hardware - Device File System (Read File)
  ipcMain.handle("hardware:readFile", async (_event, { port, filePath }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py"
        );

        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action read --path "${filePath}"`,
          { timeout: 30000 },
          (error, stdout, stderr) => {
            if (error) {
              console.error("[ElectroAI] readFile error:", error.message);
              resolve({ error: stderr || error.message });
              return;
            }

            try {
              const data = JSON.parse(stdout.trim());
              resolve(data);  // ✅ RETURN FULL OBJECT
            } catch (e) {
              console.error("[ElectroAI] readFile parse error:", stdout);
              resolve({ error: "Invalid response from device" });
            }
          }
        );
      });
    });
  });

  // 7.5 Hardware - Device File System (Write File)
  ipcMain.handle(
    "hardware:writeFile",
    async (_event, { port, filePath, content }) => {
      return withPortAccess(port, () => {
        return new Promise((resolve) => {
          const tempFilePath = path.join(
            os.tmpdir(),
            "electro_write_temp_" + Date.now() + ".py",
          );
          // Force LF newlines to avoid device blob with CRLF 
          const cleanCode = content.replace(/\r\n/g, "\n");
          try {
            fs.writeFileSync(tempFilePath, cleanCode, "utf-8");
          } catch (e) {
            resolve({ success: false, message: "Temp file error" });
            return;
          }

          const scriptPath = path.join(
            projectRoot,
            "firmware-tools",
            "core",
            "fs_manager.py",
          );
          execFile(
            getPythonExe(),
            [
              scriptPath,
              "--port",
              port,
              "--action",
              "write",
              "--path",
              filePath,
              "--localpath",
              tempFilePath,
            ],
            { timeout: 30000 },
            (error, _stdout, stderr) => {
              // clean up safely
              try {
                fs.unlinkSync(tempFilePath);
              } catch (e) { }

              if (error) {
                console.error('[ElectroAI] writeFile error:', stderr || error.message);
                resolve({ success: false, message: stderr || error.message });
              } else {
                console.log('[ElectroAI] writeFile success:', filePath);
                resolve({ success: true });
              }
            },
          );
        });
      });
    },
  );

  // 7.6 Hardware - Device File System (Delete File)
  ipcMain.handle("hardware:deleteFile", async (_event, { port, filePath }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py",
        );

        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action delete --path "${filePath}"`,
          { timeout: 30000 },
          (error, stdout) => {
            if (error) {
              resolve({ success: false, message: "Failed to delete device file" });
              return;
            }
            try {
              const data = JSON.parse(stdout.trim());
              resolve(data);
            } catch (e) {
              resolve({ success: false, message: "Invalid output from device" });
            }
          },
        );
      });
    });
  });

  // 7.7 Hardware - Device File System (Rename File)
  ipcMain.handle("hardware:renameFile", async (_event, { port, oldPath, newPath }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py",
        );

        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action rename --path "${oldPath}" --newpath "${newPath}"`,
          { timeout: 30000 },
          (error, stdout) => {
            if (error) {
              resolve({ success: false, message: "Failed to rename device file" });
              return;
            }
            try {
              const data = JSON.parse(stdout.trim());
              resolve(data);
            } catch (e) {
              resolve({ success: false, message: "Invalid output from device" });
            }
          },
        );
      });
    });
  });

  // 8. AI Engine - Generate Code
  ipcMain.handle("ai:generate", async (_event, _args) => {
    // Placeholder for AI Engine
    return {
      code: "# Generated by ElectroAI\nfrom machine import Pin\nled = Pin(25, Pin.OUT)\nled.toggle()",
      wiring: "Connect your component according to the standard pinout.",
    };
  });
}

// --- APP LIFECYCLE ---

app.on("window-all-closed", () => {
  // Always clean up the monitor if the app closes!
  if (monitorProcess) monitorProcess.kill();

  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
});