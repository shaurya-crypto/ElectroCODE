import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, execSync, spawn, execFile, ChildProcess } from "node:child_process";
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
let mcpProcess: ChildProcess | null = null; // MCP Server process

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
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless window
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
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

  // API Config / .env Sync
  ipcMain.handle("saveApiSettings", async (_, config) => {
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

      return new Promise((resolve) => {
        const tempFilePath = path.join(os.tmpdir(), "electro_temp.py");
        try {
          fs.writeFileSync(tempFilePath, code, "utf-8");
        } catch {
          resolve({ success: false, message: "Failed to write temp file" });
          return;
        }

        // Wait for Windows to release COM port lock (stopMonitor already waited, wait an extra 1000ms)
        setTimeout(() => {
          const uploaderPath = path.join(
            path.join(process.env.APP_ROOT!, ".."),
            "firmware-tools",
            "core",
            "uploader.py",
          );

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
            runProcess.on("close", () => {
              if (monitorProcess === runProcess) monitorProcess = null;
            });

            // Resolve immediately so the UI knows it started
            resolve({ success: true, message: "Streaming live execution" });
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
                const monitorPath = path.join(
                  path.join(process.env.APP_ROOT!, ".."),
                  "firmware-tools",
                  "serial",
                  "monitor.py",
                );
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
                monitorProcess.stderr?.on("data", (data) => {
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
        const monitorPath = path.join(process.env.APP_ROOT!, "..", "firmware-tools", "serial", "monitor.py");
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
}

function startMcpServer() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  let mcpPath: string;

  if (isDev) {
    mcpPath = path.join(process.env.APP_ROOT!, "..", "mcp-server", "src", "server.js");
  } else {
    // In production, mcp-server is placed in resources
    mcpPath = path.join(process.resourcesPath, "mcp-server", "src", "server.js");
  }

  if (fs.existsSync(mcpPath)) {
    console.log(`[ElectroAI] Starting MCP Server at ${mcpPath}...`);
    mcpProcess = spawn("node", [mcpPath], {
      stdio: "inherit",
      env: { ...process.env, PORT: "3001" } // Default MCP port
    });

    mcpProcess.on("error", (err) => {
      console.error("[ElectroAI] Failed to start MCP Server:", err);
    });

    mcpProcess.on("close", (code) => {
      console.log(`[ElectroAI] MCP Server exited with code ${code}`);
    });
  } else {
    console.warn(`[ElectroAI] MCP Server not found at ${mcpPath}`);
  }
}

// --- APP LIFECYCLE ---

app.on("window-all-closed", () => {
  // Always clean up the monitor if the app closes!
  if (monitorProcess) monitorProcess.kill();
  if (mcpProcess) mcpProcess.kill();

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