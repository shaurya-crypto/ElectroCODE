import { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, execSync, spawn, execFile, ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import https from "node:https";

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
let mcpProcess: ChildProcess | null = null; // MCP Server process

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function getResourcePath(subPath: string): string {
  if (!app.isPackaged) {
    // Development: Use standard relative paths (project root)
    return path.join(process.env.APP_ROOT!, "..", subPath);
  }
  // Production: Use process.resourcesPath for bundled folders
  // All backend resources are nested under _internal/ to keep the install directory clean
  return path.join(process.resourcesPath, "_internal", subPath);
}

function getPythonExe(): string {
  if (process.platform === "win32") {
    // Check Thonny Python as fallback since Windows Appalias can cause 'python' command to fail
    const thonnyPath = path.join(os.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    if (fs.existsSync(thonnyPath)) {
      return thonnyPath;
    }
    return "python";
  }
  // Linux / macOS fallback
  try {
    execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch {
    return "python";
  }
}

// --- SECURITY HELPERS ---
function encryptValue(value: string): string {
  if (!value) return "";
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(value);
      return `enc:${buffer.toString("base64")}`;
    }
    console.warn("[Security] safeStorage not available. Storing in plain-text.");
    return value;
  } catch (err) {
    console.error("[Security] Encryption failed:", err);
    return value;
  }
}

function decryptValue(value: string): string {
  if (!value || !value.startsWith("enc:")) return value;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const base64Content = value.substring(4);
      const buffer = Buffer.from(base64Content, "base64");
      return safeStorage.decryptString(buffer);
    }
    return value;
  } catch (err) {
    console.error("[Security] Decryption failed:", err);
    return value;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless window
    icon: app.isPackaged 
      ? path.join(process.resourcesPath, "icon.ico") 
      : path.join(process.env.VITE_PUBLIC!, "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Vite plugin-electron compiles preload.ts to .js
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
    if (!monitorProcess) return resolve(true);

    const proc = monitorProcess;
    monitorProcess = null;

    let finished = false;

    const done = () => {
      if (!finished) {
        finished = true;
        // Give Windows a moment to fully release the COM port handle
        setTimeout(() => resolve(true), 500);
      }
    };

    // When process actually stops
    proc.once("close", done);
    proc.once("exit", done);
    proc.once("error", done);

    if (process.platform === "win32" && proc.pid) {
      // 🔴 Windows: MUST use taskkill /T /F IMMEDIATELY to kill the entire
      // process tree. SIGINT only kills the parent python.exe but leaves
      // child processes (mpremote, etc.) alive, holding the COM port locked.
      try {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
      } catch { }
      // taskkill is synchronous, give a moment for close event
      setTimeout(done, 1000);
    } else {
      // Unix: graceful SIGINT, then escalate
      try {
        proc.kill("SIGINT");
      } catch { }

      setTimeout(() => {
        try { proc.kill("SIGTERM"); } catch { }
      }, 1500);

      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { }
        done();
      }, 3000);
    }
  });
}

// Helper: run a device operation with guaranteed port access
// Does NOT auto-restart the monitor — callers must restart it explicitly if needed
async function withPortAccess<T>(_port: string, operation: () => Promise<T>): Promise<T> {
  await stopMonitorNative();
  return await operation();
}

function setupIpcHandlers() {
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

  ipcMain.handle("fs:readDir", async (_, { dirPath }) => {
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

  ipcMain.handle("fs:readFile", async (_, { filePath }) => {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle("fs:createFile", async (_, { filePath, content = "" }) => {
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:createFolder", async (_, { folderPath }) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:delete", async (_, { filePath }) => {
    try {
      fs.rmSync(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("fs:rename", async (_, { oldPath, newPath }) => {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  // API Config / settings.json sync
  ipcMain.handle("saveApiSettings", async (_, config) => {
    try {
      const configDir = path.join(app.getPath("userData"), "config");
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const settingsPath = path.join(configDir, "settings.json");
      
      // Sensitive data handled in production manner
      const secureConfig = {
        ...config,
        apiKey: encryptValue(config.apiKey),
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(settingsPath, JSON.stringify(secureConfig, null, 2), "utf-8");
      return { success: true, path: settingsPath };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("loadApiSettings", async () => {
    try {
      const settingsPath = path.join(app.getPath("userData"), "config", "settings.json");
      if (!fs.existsSync(settingsPath)) return null;

      const content = fs.readFileSync(settingsPath, "utf-8");
      const config = JSON.parse(content);
      
      // Decrypt for UI usage (if UI needs to see it)
      // Note: In strict proxy mode, UI might not even need the real key
      return {
        ...config,
        apiKey: decryptValue(config.apiKey)
      };
    } catch (e) {
      return null;
    }
  });

  // Scan real ports
  ipcMain.handle("hardware:listPorts", async () => {
    return new Promise((resolve) => {
      exec(
        `"${getPythonExe()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
        { timeout: 10000 },
        (err, stdout) => {
          if (err) {
            resolve([]);
            return;
          }
          try {
            const ports = JSON.parse(stdout.trim());
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
    // Use stopMonitorNative() to kill the ENTIRE process tree on Windows.
    // A direct .kill() only kills the parent python.exe, leaving child
    // processes (mpremote, etc.) alive and holding the COM port locked.
    await stopMonitorNative();

    return new Promise((resolve) => {
      let resolved = false;
      const done = (result: object) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      const ser = spawn(getPythonExe(), [
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
            `Could not open ${port}. Check USB cable, drivers, and close other serial tools.`;
          done({ connected: false, message: msg });
        }
      });

      const timer = setTimeout(() => {
        ser.kill();
        done({
          connected: false,
          message: `Timeout — no response from ${port}.`,
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
    async (_, { code, port, language, boardId, deviceName, mode }) => {
      // Must cleanly stop monitor and send Ctrl+C to halt running scripts before flash/run!
      await stopMonitorNative();

      // Ensure the device isn't stuck in an infinite loop holdout by brutally sending Ctrl+C
      await new Promise((resolve) => {
        const stopScript = `
import serial, sys, time
for attempt in range(5):
    try:
        s = serial.Serial('${port}', 115200, timeout=0.5)
        s.write(b'\\r\\x03\\x03\\x03')  
        time.sleep(0.2)
        s.close()
        break
    except Exception:
        time.sleep(0.2)
`;
        const ser = spawn(getPythonExe(), ["-c", stopScript]);
        ser.on("close", resolve);
      });

      return new Promise((resolve) => {
        const tempFilePath = path.join(os.tmpdir(), "electro_temp.py");
        try {
          fs.writeFileSync(tempFilePath, code, "utf-8");
        } catch {
          resolve({ success: false, message: "Failed to write temp file" });
          return;
        }

        // Wait a tiny bit for Windows to fully flush handles
        setTimeout(() => {
          const uploaderPath = getResourcePath(path.join("firmware-tools", "core", "uploader.py"));

          const args = [
            uploaderPath,
            "--port",
            port,
            "--file",
            tempFilePath,
            "--language",
            language,
            "--board-id",
            boardId ?? "arduino:avr:uno",
          ];

          if (deviceName) {
            args.push("--device-name", deviceName);
          }
          if (mode) {
            args.push("--mode", mode);
          }

          if (mode === "run") {
            // Live stream execution - acts as the active monitor
            const runProcess = spawn(getPythonExe(), args);
            monitorProcess = runProcess;

            runProcess.stdout?.on("data", (data) => {
              if (win) win.webContents.send("terminal-output", data.toString("utf8"))
            });
            runProcess.stderr?.on("data", (data) => {
              if (win) win.webContents.send("terminal-output", data.toString("utf8"))
            });
            
            runProcess.on("close", (code) => {
              if (monitorProcess === runProcess) monitorProcess = null;
              if (code === 0 || code === null) {
                resolve({ success: true, message: "Execution finished" });
              } else {
                resolve({ success: false, message: "" }); // errors are already streamed
              }
            });

            // Do NOT resolve immediately. Keep the promise alive so the UI knows execution is ongoing.
            // This enables the "Stop" button in the UI.
          } else {
            // Flash mode: wait for completion, then start monitor automatically
            execFile(
              getPythonExe(),
              args,
              { timeout: 60000 },
              (error, stdout, stderr) => {
                if (error) {
                  resolve({
                    success: false,
                    message: stderr.trim() || stdout.trim() || error.message,
                  });
                  return;
                }

                // Restart standard monitor
                const monitorPath = getResourcePath(path.join("firmware-tools", "serial", "monitor.py"));
                monitorProcess = spawn(getPythonExe(), [
                  monitorPath,
                  "--port",
                  port,
                  "--baud",
                  "115200",
                ]);

                monitorProcess.stdout?.on("data", (data) => {
                  if (win) {
                    win.webContents.send("terminal-output", data.toString("utf8"))
                  }
                });
                monitorProcess.stderr?.on("data", () => {
                });
                monitorProcess.on("close", () => {
                  monitorProcess = null;
                });

                resolve({
                  success: true,
                  message: stdout.trim() || "Upload complete — device running",
                });
              },
            );
          }
        }, 1000);
      });
    },
  );

  // 4. Hardware - Start Live Serial Monitor
  ipcMain.handle(
    "hardware:startMonitor",
    async (_, { port, baudRate = 115200 }) => {
      if (monitorProcess)
        return { success: false, message: "Monitor already running" };

      const scriptPath = getResourcePath(path.join("firmware-tools", "serial", "monitor.py"));

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
          win.webContents.send("terminal-output", data.toString("utf8"))
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

  // 5.5 Hardware - Explicitly Stop Execution on Device
  let isStoppingExecution = false;
  ipcMain.handle("hardware:stopExecution", async (_, { port }) => {
    if (isStoppingExecution) {
      return { success: false, message: "Stop already in progress" };
    }

    isStoppingExecution = true;
    await stopMonitorNative();

    return new Promise((resolve) => {
      const stopScript = `
import serial, sys, time

success = False
for attempt in range(15):
    try:
        s = serial.Serial('${port}', 115200, timeout=1)
        # Send Ctrl+C multiple times to ensure break
        s.write(b'\\r\\x03\\x03\\x03')  
        time.sleep(0.2)
        s.close()
        success = True
        break
    except Exception as e:
        time.sleep(0.2)

if not success:
    sys.exit(1)
`;
      const ser = spawn(getPythonExe(), ["-c", stopScript]);

      ser.on("close", () => {
        // Restart standard monitor
        const monitorPath = getResourcePath(path.join("firmware-tools", "serial", "monitor.py"));
        monitorProcess = spawn(getPythonExe(), [monitorPath, "--port", port, "--baud", "115200"]);

        monitorProcess.stdout?.on("data", (data) => {
          if (win) win.webContents.send("terminal-output", data.toString("utf8"))
        });
        monitorProcess.stderr?.on("data", (data) => {
          console.error(`Monitor Error: ${data}`);
        });
        monitorProcess.on("close", () => { monitorProcess = null; });

        isStoppingExecution = false;
        resolve({ success: true });
      });
    });
  });

  // 6. Hardware - Device File System (List Files)
  ipcMain.handle("hardware:listFiles", async (_event, { port }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));

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
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));

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
          try {
            fs.writeFileSync(tempFilePath, content, "utf-8");
          } catch (e) {
            resolve({ success: false, message: "Temp file error" });
            return;
          }

          const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));
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
            (error, stderr) => {
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
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));

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
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));

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

  // 8. AI Engine - Generate Code (Proxied through Main)
  ipcMain.handle("ai:generate", async (_, payload) => {
    try {
      // 1. Load and decrypt configuration
      const settingsPath = path.join(app.getPath("userData"), "config", "settings.json");
      if (!fs.existsSync(settingsPath)) {
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      }

      const content = fs.readFileSync(settingsPath, "utf-8");
      const config = JSON.parse(content);
      const decryptedKey = decryptValue(config.apiKey);
      
      // 2. Forward request to MCP Server which handles context composition
      //    IMPORTANT: Use Node.js native http.request, NOT fetch.
      //    Electron's production build routes `fetch` through Chromium's net
      //    stack, which can silently fail on localhost connections.
      const requestBody = JSON.stringify({
        ...payload,
        apiConfig: {
          ...config,
          apiKey: decryptedKey
        }
      });

      const result: any = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: 4000,
            path: "/api/v1/ai/generate",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(requestBody),
            },
          },
          (res: any) => {
            let body = "";
            res.on("data", (chunk: any) => (body += chunk));
            res.on("end", () => {
              try {
                const json = JSON.parse(body);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(json);
                } else {
                  reject(new Error(json.error || `MCP Server error: ${res.statusCode}`));
                }
              } catch {
                reject(new Error(`MCP Server returned invalid JSON (status ${res.statusCode})`));
              }
            });
          }
        );

        req.on("error", (err: any) => {
          reject(new Error(`Cannot reach MCP Server: ${err.message}. Is it running?`));
        });

        req.write(requestBody);
        req.end();
      });

      // The result from MCP server is { success: true, data: { ... } }
      return {
        success: true,
        response_text: result.data
      };
    } catch (e: any) {
      console.error("[AiProxy] Generation failed:", e);
      return { success: false, error: { type: "RUNTIME", message: e.message } };
    }
  });

  // 9. Window Controls
  ipcMain.handle("window:minimize", () => {
    win?.minimize();
  });
  ipcMain.handle("window:maximize", () => {
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle("window:close", () => {
    win?.close();
  });

  // 10. Terminal REPL Input — write to the serial monitor's stdin
  ipcMain.handle("terminal:sendInput", async (_, data: string) => {
    if (monitorProcess && monitorProcess.stdin) {
      try {
        monitorProcess.stdin.write(data);
        return { success: true };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    }
    return { success: false, message: "No active serial monitor" };
  });

  // 11. Firmware - List mounted volumes (for UF2 bootloader detection)
  ipcMain.handle("firmware:listVolumes", async () => {
    try {
      if (process.platform === "win32") {
        // Use WMIC to list removable drives
        return new Promise((resolve) => {
          exec('wmic logicaldisk where "DriveType=2" get DeviceID,VolumeName /format:csv', (err, stdout) => {
            if (err) { resolve([]); return; }
            const lines = stdout.trim().split('\n').filter(l => l.includes(','));
            // Skip header
            const volumes = lines.slice(1).map(line => {
              const parts = line.trim().split(',');
              // CSV format: Node,DeviceID,VolumeName
              const deviceId = parts[1] || '';
              const name = parts[2] || 'Removable Disk';
              return { path: deviceId + '\\', label: `${name} (${deviceId})` };
            }).filter(v => v.path.length > 1);
            resolve(volumes);
          });
        });
      } else if (process.platform === "darwin") {
        const volDir = '/Volumes';
        if (!fs.existsSync(volDir)) return [];
        const entries = fs.readdirSync(volDir);
        return entries.map(name => ({
          path: path.join(volDir, name),
          label: name,
        }));
      } else {
        // Linux: check /media/<user> and /run/media/<user>
        const user = os.userInfo().username;
        const dirs = [`/media/${user}`, `/run/media/${user}`];
        const volumes: { path: string; label: string }[] = [];
        for (const dir of dirs) {
          if (fs.existsSync(dir)) {
            for (const name of fs.readdirSync(dir)) {
              volumes.push({ path: path.join(dir, name), label: name });
            }
          }
        }
        return volumes;
      }
    } catch {
      return [];
    }
  });

  // 12. Firmware - Install (copy UF2/BIN file to target volume with real progress)
  ipcMain.handle("firmware:install", async (_, { sourcePath, targetVolume }) => {
    try {
      if (!fs.existsSync(sourcePath)) {
        return { success: false, message: "Firmware file not found: " + sourcePath };
      }

      const fileName = path.basename(sourcePath);
      const destPath = path.join(targetVolume, fileName);
      const stat = fs.statSync(sourcePath);
      const totalBytes = stat.size;

      if (totalBytes === 0) {
        return { success: false, message: "Firmware file is empty" };
      }

      // Stream-copy with real progress events
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(destPath);
      let copiedBytes = 0;

      readStream.on('data', (chunk: any) => {
        copiedBytes += chunk.length;
        const percent = Math.round((copiedBytes / totalBytes) * 100);
        if (win) {
          win.webContents.send('firmware-progress', {
            percent,
            message: `Copying ${fileName}... ${percent}%`,
          });
        }
      });

      return new Promise((resolve) => {
        writeStream.on('finish', () => {
          if (win) {
            win.webContents.send('firmware-progress', {
              percent: 100,
              message: 'Firmware installed successfully!',
              done: true,
            });
          }
          resolve({ success: true });
        });

        writeStream.on('error', (err) => {
          if (win) {
            win.webContents.send('firmware-progress', {
              percent: 0,
              message: err.message,
              error: err.message,
            });
          }
          resolve({ success: false, message: err.message });
        });

        readStream.on('error', (err) => {
          if (win) {
            win.webContents.send('firmware-progress', {
              percent: 0,
              message: err.message,
              error: err.message,
            });
          }
          resolve({ success: false, message: err.message });
        });

        readStream.pipe(writeStream);
      });
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  // 13. Shell - Open external URL in default browser
  ipcMain.handle("shell:openExternal", async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  // 14. Firmware - Download firmware from URL with progress
  ipcMain.handle("firmware:download", async (_, { url, fileName }) => {
    try {
      const cacheDir = path.join(app.getPath("userData"), "firmware-cache");
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const destPath = path.join(cacheDir, fileName);

      // Check cache — if file already exists and is > 0 bytes, skip download
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        console.log(`[Firmware] Using cached: ${destPath}`);
        if (win) {
          win.webContents.send("firmware-progress", {
            percent: 100,
            message: "Using cached firmware file...",
          });
        }
        return { success: true, filePath: destPath };
      }

      // Download with progress using native https (works in production)
      return new Promise((resolve) => {
        const doDownload = (downloadUrl: string, redirectCount = 0) => {
          if (redirectCount > 5) {
            resolve({ success: false, message: "Too many redirects" });
            return;
          }

          const httpModule = downloadUrl.startsWith("https") ? https : http;
          httpModule.get(downloadUrl, (res: any) => {
            // Handle redirects (301, 302, 303, 307, 308)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const redirectUrl = res.headers.location;
              const redirectModule = redirectUrl.startsWith("https") ? https : http;
              // Use the redirect module for the new URL
              redirectModule.get(redirectUrl, (res2: any) => {
                if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
                  doDownload(res2.headers.location, redirectCount + 2);
                  return;
                }
                handleResponse(res2);
              }).on("error", (err: any) => {
                resolve({ success: false, message: `Download failed: ${err.message}` });
              });
              return;
            }

            handleResponse(res);
          }).on("error", (err: any) => {
            resolve({ success: false, message: `Download failed: ${err.message}` });
          });
        };

        const handleResponse = (res: any) => {
          if (res.statusCode !== 200) {
            resolve({ success: false, message: `Server returned ${res.statusCode}` });
            return;
          }

          const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
          let downloadedBytes = 0;
          const fileStream = fs.createWriteStream(destPath);

          res.on("data", (chunk: any) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const percent = Math.round((downloadedBytes / totalBytes) * 100);
              if (win) {
                win.webContents.send("firmware-progress", {
                  percent,
                  message: `Downloading ${fileName}... ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`,
                });
              }
            } else {
              if (win) {
                win.webContents.send("firmware-progress", {
                  percent: -1,
                  message: `Downloading ${fileName}... ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`,
                });
              }
            }
          });

          res.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            console.log(`[Firmware] Downloaded: ${destPath}`);
            resolve({ success: true, filePath: destPath });
          });

          fileStream.on("error", (err: any) => {
            fs.unlinkSync(destPath); // Clean up partial file
            resolve({ success: false, message: err.message });
          });
        };

        doDownload(url);
      });
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });
}

function startMcpServer(retryCount = 0) {
  const mcpPath = getResourcePath(path.join("mcp-server", "src", "server.js"));
  const mcpRoot = getResourcePath("mcp-server");

  if (fs.existsSync(mcpPath)) {
    console.log(`[ElectroAI] Starting MCP Server at ${mcpPath}...`);
    // Use the bundled Node.js executable provided by Electron!
    // This allows it to run even if Node.js isn't installed.
    mcpProcess = spawn(process.execPath, [mcpPath], {
      cwd: mcpRoot,
      stdio: "pipe",
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: "4000",
        WS_PORT: "4001",
        // Ensure require() can find node_modules in the bundled mcp-server
        NODE_PATH: path.join(mcpRoot, "node_modules"),
      }
    });

    const mcpLogFile = path.join(app.getPath('userData'), 'mcp_debug.log');
    fs.appendFileSync(mcpLogFile, `\n--- STARTING MCP SERVER at ${new Date().toISOString()} ---\n`);
    fs.appendFileSync(mcpLogFile, `mcpPath: ${mcpPath}\ncwd: ${mcpRoot}\nNODE_PATH: ${path.join(mcpRoot, "node_modules")}\nretry: ${retryCount}\n`);

    mcpProcess.stdout?.on("data", data => {
      console.log(`[MCP] ${data}`);
      fs.appendFileSync(mcpLogFile, `[STDOUT] ${data}`);
    });
    
    mcpProcess.stderr?.on("data", data => {
      console.error(`[MCP] ${data}`);
      fs.appendFileSync(mcpLogFile, `[STDERR] ${data}`);
    });

    mcpProcess.on("error", (err) => {
      console.error("[ElectroAI] Failed to start MCP Server:", err);
      fs.appendFileSync(mcpLogFile, `[SPAWN ERROR] ${err.message}\n${err.stack}\n`);
    });

    mcpProcess.on("close", (code) => {
      console.log(`[ElectroAI] MCP Server exited with code ${code}`);
      fs.appendFileSync(mcpLogFile, `[EXIT] Code ${code}\n`);
      mcpProcess = null;

      // Auto-restart on crash (max 3 attempts)
      if (code !== 0 && code !== null && retryCount < 3) {
        console.log(`[ElectroAI] MCP crashed — restarting (attempt ${retryCount + 1}/3)...`);
        fs.appendFileSync(mcpLogFile, `[RESTART] Attempt ${retryCount + 1}/3\n`);
        setTimeout(() => startMcpServer(retryCount + 1), 2000);
      }
    });
  } else {
    console.warn(`[ElectroAI] MCP Server not found at ${mcpPath}`);
    const mcpLogFile = path.join(app.getPath('userData'), 'mcp_debug.log');
    fs.appendFileSync(mcpLogFile, `\n[NOT FOUND] ${mcpPath}\nresourcesPath: ${process.resourcesPath}\nisPackaged: ${app.isPackaged}\n`);
  }
}

// --- APP LIFECYCLE ---

function killAllProcesses() {
  if (monitorProcess) {
    try {
      if (process.platform === "win32" && monitorProcess.pid) {
        execSync(`taskkill /pid ${monitorProcess.pid} /T /F`, { stdio: "ignore" });
      } else {
        monitorProcess.kill("SIGKILL");
      }
    } catch {}
  }
  if (mcpProcess) {
    try {
      if (process.platform === "win32" && mcpProcess.pid) {
        execSync(`taskkill /pid ${mcpProcess.pid} /T /F`, { stdio: "ignore" });
      } else {
        mcpProcess.kill("SIGKILL");
      }
    } catch {}
  }
}

app.on("before-quit", () => {
  killAllProcesses();
});

app.on("window-all-closed", () => {
  killAllProcesses();
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

if (gotTheLock) {
  app.whenReady().then(() => {
    setupIpcHandlers();
    startMcpServer();
    createWindow();
  });
}