import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, spawn, execFile, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let monitorProcess = null;
let mcpProcess = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
function getResourcePath(subPath) {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    return path.join(process.env.APP_ROOT, "..", subPath);
  }
  return path.join(process.resourcesPath, subPath);
}
function getPythonExe() {
  if (process.platform === "win32") {
    const thonnyPath = path.join(os.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    if (fs.existsSync(thonnyPath)) {
      return thonnyPath;
    }
    return "python";
  }
  try {
    execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch {
    return "python";
  }
}
function encryptValue(value) {
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
function decryptValue(value) {
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
    frame: false,
    // Frameless window
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      // Vite plugin-electron compiles preload.ts to .js
      contextIsolation: true,
      // Security requirement
      nodeIntegration: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
async function stopMonitorNative() {
  return new Promise((resolve) => {
    if (!monitorProcess) return resolve(true);
    const proc = monitorProcess;
    monitorProcess = null;
    let finished = false;
    const done = () => {
      if (!finished) {
        finished = true;
        setTimeout(() => resolve(true), 500);
      }
    };
    proc.once("close", done);
    proc.once("exit", done);
    proc.once("error", done);
    if (process.platform === "win32" && proc.pid) {
      try {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
      } catch {
      }
      setTimeout(done, 1e3);
    } else {
      try {
        proc.kill("SIGINT");
      } catch {
      }
      setTimeout(() => {
        try {
          proc.kill("SIGTERM");
        } catch {
        }
      }, 1500);
      setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
        }
        done();
      }, 3e3);
    }
  });
}
async function withPortAccess(_port, operation) {
  await stopMonitorNative();
  return await operation();
}
function setupIpcHandlers() {
  ipcMain.handle("dialog:openFolder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"]
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
          content
        };
      } catch (e) {
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
        } catch (e) {
        }
        return {
          id: fullPath,
          name: child,
          type: isDir ? "folder" : "file",
          filePath: fullPath,
          children: isDir ? [] : void 0
          // Empty array signifies an unloaded folder
        };
      });
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
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("fs:createFolder", async (_, { folderPath }) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("fs:delete", async (_, { filePath }) => {
    try {
      fs.rmSync(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("fs:rename", async (_, { oldPath, newPath }) => {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("saveApiSettings", async (_, config) => {
    try {
      const configDir = path.join(app.getPath("userData"), "config");
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const settingsPath = path.join(configDir, "settings.json");
      const secureConfig = {
        ...config,
        apiKey: encryptValue(config.apiKey),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      fs.writeFileSync(settingsPath, JSON.stringify(secureConfig, null, 2), "utf-8");
      return { success: true, path: settingsPath };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("loadApiSettings", async () => {
    try {
      const settingsPath = path.join(app.getPath("userData"), "config", "settings.json");
      if (!fs.existsSync(settingsPath)) return null;
      const content = fs.readFileSync(settingsPath, "utf-8");
      const config = JSON.parse(content);
      return {
        ...config,
        apiKey: decryptValue(config.apiKey)
      };
    } catch (e) {
      return null;
    }
  });
  ipcMain.handle("hardware:listPorts", async () => {
    return new Promise((resolve) => {
      exec(
        `"${getPythonExe()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
        { timeout: 1e4 },
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
              stdout
            );
            resolve([]);
          }
        }
      );
    });
  });
  ipcMain.handle("hardware:checkChip", async (_, { port }) => {
    await stopMonitorNative();
    return new Promise((resolve) => {
      let resolved = false;
      const done = (result) => {
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
`
      ]);
      let out = "";
      let errBuf = "";
      ser.stdout.on("data", (d) => out += d.toString());
      ser.stderr.on("data", (d) => errBuf += d.toString());
      ser.on("error", (e) => {
        console.error("[ElectroAI] spawn error:", e.message);
        done({
          connected: false,
          message: `Python not found. Install Python and pyserial.`
        });
      });
      ser.on("close", (code) => {
        console.log(
          `[ElectroAI] checkChip python exited code=${code}, stdout="${out.trim()}", stderr="${errBuf.trim()}"`
        );
        if (out.trim() === "ok") {
          done({ connected: true });
        } else {
          const msg = errBuf.trim() || `Could not open ${port}. Check USB cable, drivers, and close other serial tools.`;
          done({ connected: false, message: msg });
        }
      });
      const timer = setTimeout(() => {
        ser.kill();
        done({
          connected: false,
          message: `Timeout — no response from ${port}.`
        });
      }, 8e3);
      ser.on("close", () => clearTimeout(timer));
    });
  });
  ipcMain.handle("dialog:saveFile", async (_, { content, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName ?? "untitled.py",
      filters: [
        { name: "Python", extensions: ["py"] },
        { name: "C/C++", extensions: ["c", "cpp", "ino", "h"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (canceled || !filePath) return { success: false };
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return { success: true, filePath, path: filePath };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle(
    "hardware:flash",
    async (_, { code, port, language, boardId, deviceName, mode }) => {
      await stopMonitorNative();
      return new Promise((resolve) => {
        const tempFilePath = path.join(os.tmpdir(), "electro_temp.py");
        try {
          fs.writeFileSync(tempFilePath, code, "utf-8");
        } catch {
          resolve({ success: false, message: "Failed to write temp file" });
          return;
        }
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
            boardId ?? "arduino:avr:uno"
          ];
          if (deviceName) {
            args.push("--device-name", deviceName);
          }
          if (mode) {
            args.push("--mode", mode);
          }
          if (mode === "run") {
            const runProcess = spawn(getPythonExe(), args);
            monitorProcess = runProcess;
            runProcess.stdout?.on("data", (data) => {
              if (win) win.webContents.send("terminal-output", data.toString("utf8"));
            });
            runProcess.stderr?.on("data", (data) => {
              if (win) win.webContents.send("terminal-output", data.toString("utf8"));
            });
            runProcess.on("close", () => {
              if (monitorProcess === runProcess) monitorProcess = null;
            });
            resolve({ success: true, message: "Streaming live execution" });
          } else {
            execFile(
              getPythonExe(),
              args,
              { timeout: 6e4 },
              (error, stdout, stderr) => {
                if (error) {
                  resolve({
                    success: false,
                    message: stderr.trim() || stdout.trim() || error.message
                  });
                  return;
                }
                const monitorPath = getResourcePath(path.join("firmware-tools", "serial", "monitor.py"));
                monitorProcess = spawn(getPythonExe(), [
                  monitorPath,
                  "--port",
                  port,
                  "--baud",
                  "115200"
                ]);
                monitorProcess.stdout?.on("data", (data) => {
                  if (win) {
                    win.webContents.send("terminal-output", data.toString("utf8"));
                  }
                });
                monitorProcess.stderr?.on("data", () => {
                });
                monitorProcess.on("close", () => {
                  monitorProcess = null;
                });
                resolve({
                  success: true,
                  message: stdout.trim() || "Upload complete — device running"
                });
              }
            );
          }
        }, 1e3);
      });
    }
  );
  ipcMain.handle(
    "hardware:startMonitor",
    async (_, { port, baudRate = 115200 }) => {
      if (monitorProcess)
        return { success: false, message: "Monitor already running" };
      const scriptPath = getResourcePath(path.join("firmware-tools", "serial", "monitor.py"));
      monitorProcess = spawn(getPythonExe(), [
        scriptPath,
        "--port",
        port,
        "--baud",
        baudRate.toString()
      ]);
      monitorProcess.stdout?.on("data", (data) => {
        if (win) {
          win.webContents.send("terminal-output", data.toString("utf8"));
        }
      });
      monitorProcess.stderr?.on("data", (data) => {
        console.error(`Monitor Error: ${data}`);
      });
      monitorProcess.on("close", () => {
        monitorProcess = null;
      });
      return { success: true };
    }
  );
  ipcMain.handle("hardware:stopMonitor", async () => {
    await stopMonitorNative();
    return { success: true };
  });
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
        const monitorPath = getResourcePath(path.join("firmware-tools", "serial", "monitor.py"));
        monitorProcess = spawn(getPythonExe(), [monitorPath, "--port", port, "--baud", "115200"]);
        monitorProcess.stdout?.on("data", (data) => {
          if (win) win.webContents.send("terminal-output", data.toString("utf8"));
        });
        monitorProcess.stderr?.on("data", (data) => {
          console.error(`Monitor Error: ${data}`);
        });
        monitorProcess.on("close", () => {
          monitorProcess = null;
        });
        isStoppingExecution = false;
        resolve({ success: true });
      });
    });
  });
  ipcMain.handle("hardware:listFiles", async (_event, { port }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));
        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action list`,
          { timeout: 3e4 },
          (error, stdout) => {
            if (error) {
              console.error("[ElectroAI] listFiles error:", error.message);
              resolve({ error: "Failed to read device" });
              return;
            }
            try {
              const files = JSON.parse(stdout.trim());
              resolve(files);
            } catch (e) {
              console.error("[ElectroAI] listFiles parse error:", stdout);
              resolve({ error: "Invalid data from device" });
            }
          }
        );
      });
    });
  });
  ipcMain.handle("hardware:readFile", async (_event, { port, filePath }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));
        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action read --path "${filePath}"`,
          { timeout: 3e4 },
          (error, stdout, stderr) => {
            if (error) {
              console.error("[ElectroAI] readFile error:", error.message);
              resolve({ error: stderr || error.message });
              return;
            }
            try {
              const data = JSON.parse(stdout.trim());
              resolve(data);
            } catch (e) {
              console.error("[ElectroAI] readFile parse error:", stdout);
              resolve({ error: "Invalid response from device" });
            }
          }
        );
      });
    });
  });
  ipcMain.handle(
    "hardware:writeFile",
    async (_event, { port, filePath, content }) => {
      return withPortAccess(port, () => {
        return new Promise((resolve) => {
          const tempFilePath = path.join(
            os.tmpdir(),
            "electro_write_temp_" + Date.now() + ".py"
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
              tempFilePath
            ],
            { timeout: 3e4 },
            (error, stderr) => {
              try {
                fs.unlinkSync(tempFilePath);
              } catch (e) {
              }
              if (error) {
                console.error("[ElectroAI] writeFile error:", stderr || error.message);
                resolve({ success: false, message: stderr || error.message });
              } else {
                console.log("[ElectroAI] writeFile success:", filePath);
                resolve({ success: true });
              }
            }
          );
        });
      });
    }
  );
  ipcMain.handle("hardware:deleteFile", async (_event, { port, filePath }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));
        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action delete --path "${filePath}"`,
          { timeout: 3e4 },
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
          }
        );
      });
    });
  });
  ipcMain.handle("hardware:renameFile", async (_event, { port, oldPath, newPath }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = getResourcePath(path.join("firmware-tools", "core", "fs_manager.py"));
        exec(
          `"${getPythonExe()}" "${scriptPath}" --port ${port} --action rename --path "${oldPath}" --newpath "${newPath}"`,
          { timeout: 3e4 },
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
          }
        );
      });
    });
  });
  ipcMain.handle("ai:generate", async (_, payload) => {
    try {
      const settingsPath = path.join(app.getPath("userData"), "config", "settings.json");
      if (!fs.existsSync(settingsPath)) {
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      }
      const content = fs.readFileSync(settingsPath, "utf-8");
      const config = JSON.parse(content);
      const decryptedKey = decryptValue(config.apiKey);
      const mcpUrl = "http://localhost:4000/api/v1/ai/generate";
      const response = await fetch(mcpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          // prompt, sessionId, etc.
          apiConfig: {
            ...config,
            apiKey: decryptedKey
          }
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `MCP Server error: ${response.status}`);
      }
      const result = await response.json();
      return {
        success: true,
        response_text: result.data
      };
    } catch (e) {
      console.error("[AiProxy] Generation failed:", e);
      return { success: false, error: { type: "RUNTIME", message: e.message } };
    }
  });
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
  const mcpPath = getResourcePath(path.join("mcp-server", "src", "server.js"));
  if (fs.existsSync(mcpPath)) {
    console.log(`[ElectroAI] Starting MCP Server at ${mcpPath}...`);
    mcpProcess = spawn(process.execPath, [mcpPath], {
      stdio: "pipe",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: "4000", WS_PORT: "4001" }
    });
    mcpProcess.stdout?.on("data", (data) => console.log(`[MCP] ${data}`));
    mcpProcess.stderr?.on("data", (data) => console.error(`[MCP] ${data}`));
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
function killAllProcesses() {
  if (monitorProcess) {
    try {
      if (process.platform === "win32" && monitorProcess.pid) {
        execSync(`taskkill /pid ${monitorProcess.pid} /T /F`, { stdio: "ignore" });
      } else {
        monitorProcess.kill("SIGKILL");
      }
    } catch {
    }
  }
  if (mcpProcess) {
    try {
      if (process.platform === "win32" && mcpProcess.pid) {
        execSync(`taskkill /pid ${mcpProcess.pid} /T /F`, { stdio: "ignore" });
      } else {
        mcpProcess.kill("SIGKILL");
      }
    } catch {
    }
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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
