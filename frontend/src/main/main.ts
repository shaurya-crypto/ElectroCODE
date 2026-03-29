import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, spawn, execFile, ChildProcess } from "node:child_process";
import fs from "node:fs"; // <-- ADD THIS
import os from "node:os"; // <-- ADD THIS

const require = createRequire(import.meta.url);
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
let currentMonitorPort: string | null = null;

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

async function stopMonitorNative(): Promise<boolean> {
  return new Promise((resolve) => {
    if (monitorProcess) {
      const proc = monitorProcess;
      monitorProcess = null;
      currentMonitorPort = null;

      proc.on("close", () => {
        // Give the OS time to fully release the serial port handle
        setTimeout(() => resolve(true), 800);
      });

      proc.kill();

      // Safety: if process does not close within 3s, resolve anyway
      setTimeout(() => resolve(true), 3000);
    } else {
      currentMonitorPort = null;
      resolve(true);
    }
  });
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

  ipcMain.handle("fs:readDir", async (event, { dirPath }) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) return [];

      const children = fs.readdirSync(dirPath).map((child) => {
        const fullPath = path.join(dirPath, child);
        let isDir = false;
        try {
          isDir = fs.statSync(fullPath).isDirectory();
        } catch(e) {}
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

  ipcMain.handle("fs:readFile", async (event, { filePath }) => {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle("fs:createFile", async (event, { filePath, content = "" }) => {
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:createFolder", async (event, { folderPath }) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:delete", async (event, { filePath }) => {
    try {
      fs.rmSync(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:rename", async (event, { oldPath, newPath }) => {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  // API Config / .env Sync
  ipcMain.handle("saveApiSettings", async (event, config) => {
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
        "python -c \"import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))\"",
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

  // Check chip is actually connected — just verify the port can be opened (works for ALL chip types)
  ipcMain.handle("hardware:checkChip", async (_, { port }) => {
    console.log(`[ElectroAI] Checking chip on ${port}...`);
    return new Promise((resolve) => {
      if (monitorProcess) {
        monitorProcess.kill();
        monitorProcess = null;
      }

      let resolved = false;
      const done = (result: object) => {
        if (!resolved) {
          resolved = true;
          console.log("[ElectroAI] checkChip result:", result);
          resolve(result);
        }
      };

      const ser = spawn("python", [
        "-c",
        `
import serial, sys, time
try:
    s = serial.Serial('${port}', 115200, timeout=2)
    time.sleep(0.3)
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

      // If python is not found on PATH, spawn emits 'error' not 'close'
      ser.on("error", (e) => {
        console.error("[ElectroAI] spawn error:", e.message);
        done({
          connected: false,
          message: `Python not found. Install Python and pyserial.`,
        });
      });

      ser.on("close", (code) => {
        console.log(
          `[ElectroAI] checkChip python exited code=${code}, stdout="${out.trim()}", stderr="${errBuf.trim()}"`,
        );
        if (out.trim() === "ok") {
          done({ connected: true });
        } else {
          const msg =
            errBuf.trim() ||
            `Could not open ${port}. Check USB cable, drivers, and close other serial tools (Thonny, Arduino IDE, PuTTY).`;
          done({ connected: false, message: msg });
        }
      });

      // Safety timeout — kill if Python hangs
      const timer = setTimeout(() => {
        ser.kill();
        done({
          connected: false,
          message: `Timeout — no response from ${port}. Is the port correct?`,
        });
      }, 8000);

      ser.on("close", () => clearTimeout(timer));
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
    async (event, { code, port, language, boardId }) => {
      // Must cleanly stop monitor and send Ctrl+C to halt running scripts before flash!
      await stopMonitorNative();

      return new Promise((resolve) => {
        const tempFilePath = path.join(os.tmpdir(), "electro_temp.py");
        try {
          fs.writeFileSync(tempFilePath, code, "utf-8");
        } catch {
          resolve({ success: false, message: "Failed to write temp file" });
          return;
        }

        // Wait for Windows to release COM port lock (stopMonitor already waited 500ms, wait an extra 500ms)
        setTimeout(() => {
          const scriptPath = path.join(
            path.join(process.env.APP_ROOT!, ".."),
            "firmware-tools",
            "core",
            "uploader.py",
          );

          execFile(
            "python",
            [
              scriptPath,
              "--port",
              port,
              "--file",
              tempFilePath,
              "--language",
              language,
              "--board-id",
              boardId ?? "arduino:avr:uno",
            ],
            { timeout: 60000 },
            (error, stdout, stderr) => {
              if (error) {
                resolve({
                  success: false,
                  message: stderr.trim() || stdout.trim() || error.message,
                });
                return;
              }

              // Replaced inline monitor start. The frontend triggers `hardware:startMonitor` directly!

              resolve({
                success: true,
                message: stdout.trim() || "Upload complete — device running",
              });
            },
          );
        }, 1000);
      });
    },
  );

  // 4. Hardware - Start Live Serial Monitor
  ipcMain.handle(
    "hardware:startMonitor",
    async (event, { port, baudRate = 115200 }) => {
      if (monitorProcess)
        return { success: false, message: "Monitor already running" };

      const scriptPath = path.join(
        projectRoot,
        "firmware-tools",
        "serial",
        "monitor.py",
      );

      // Use spawn() instead of exec() so we can stream the data continuously
      monitorProcess = spawn("python", [
        scriptPath,
        "--port",
        port,
        "--baud",
        baudRate.toString(),
      ]);
      currentMonitorPort = port;

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
  ipcMain.handle("hardware:listFiles", async (event, { port }) => {
    return new Promise((resolve) => {
      const scriptPath = path.join(
        projectRoot,
        "firmware-tools",
        "core",
        "fs_manager.py",
      );

      exec(
        `python "${scriptPath}" --port ${port} --action list`,
        (error, stdout) => {
          if (error) {
            resolve({ error: "Failed to read device" });
            return;
          }
          try {
            const files = JSON.parse(stdout.trim());
            resolve(files);
          } catch (e) {
            resolve({ error: "Invalid data from device" });
          }
        },
      );
    });
  });

  // 7. Hardware - Device File System (Read File)
  ipcMain.handle("hardware:readFile", async (event, { port, filePath }) => {
    return new Promise((resolve) => {
      const scriptPath = path.join(
        projectRoot,
        "firmware-tools",
        "core",
        "fs_manager.py",
      );

      exec(
        `python "${scriptPath}" --port ${port} --action read --path "${filePath}"`,
        (error, stdout) => {
          try {
            const data = JSON.parse(stdout.trim());
            resolve(data.content);
          } catch (e) {
            resolve(null);
          }
        },
      );
    });
  });

  // 7.5 Hardware - Device File System (Write File)
  ipcMain.handle(
    "hardware:writeFile",
    async (event, { port, filePath, content }) => {
      return new Promise((resolve) => {
        const tempFilePath = path.join(
          os.tmpdir(),
          "electro_write_temp_" + Date.now() + ".py",
        );
        try {
          fs.writeFileSync(tempFilePath, content, "utf-8");
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
          "python",
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
          (error, stdout, stderr) => {
            // clean up safely
            try {
              fs.unlinkSync(tempFilePath);
            } catch (e) {}

            if (error) {
              resolve({ success: false, message: stderr || error.message });
            } else {
              resolve({ success: true });
            }
          },
        );
      });
    },
  );

  // 7.6 Hardware - Device File System (Delete File)
  ipcMain.handle("hardware:deleteFile", async (event, { port, filePath }) => {
    return new Promise((resolve) => {
      const scriptPath = path.join(
        projectRoot,
        "firmware-tools",
        "core",
        "fs_manager.py",
      );

      exec(
        `python "${scriptPath}" --port ${port} --action delete --path "${filePath}"`,
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
