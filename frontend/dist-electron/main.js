import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exec, spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let monitorProcess = null;
let currentFlashProcess = null;
function getPythonExe() {
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
      preload: path.join(__dirname$1, "preload.mjs"),
      // Vite compiles preload.ts to .mjs
      contextIsolation: true,
      // Security requirement
      nodeIntegration: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
async function stopMonitorNative() {
  var _a;
  if (currentFlashProcess) {
    try {
      (_a = currentFlashProcess.stdin) == null ? void 0 : _a.write("");
      currentFlashProcess.kill();
    } catch (e) {
    }
    currentFlashProcess = null;
  }
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
    proc.once("close", done);
    proc.once("exit", done);
    proc.once("error", done);
    try {
      proc.kill("SIGINT");
      if (proc.stdin) {
        proc.stdin.write("");
      }
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
  });
}
async function withPortAccess(_port, operation) {
  await stopMonitorNative();
  return await operation();
}
function setupIpcHandlers() {
  const projectRoot = path.join(process.env.APP_ROOT, "..");
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
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("fs:createFolder", async (event, { folderPath }) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("fs:delete", async (event, { filePath }) => {
    try {
      fs.rmSync(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("fs:rename", async (event, { oldPath, newPath }) => {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("saveApiSettings", async (event, config) => {
    try {
      const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
      const electroDir = path.join(LOCAL_APP_DATA, "ElectroAI");
      if (!fs.existsSync(electroDir)) {
        fs.mkdirSync(electroDir, { recursive: true });
      }
      const envPath = path.join(electroDir, ".env");
      let envContent = `ACTIVE_PROVIDER=${config.provider || "anthropic"}
API_KEY=${config.apiKey || ""}
MODEL=${config.model || ""}
`;
      fs.writeFileSync(envPath, envContent, "utf-8");
      return { success: true, path: envPath };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  ipcMain.handle("hardware:listPorts", async () => {
    return new Promise((resolve) => {
      console.log("[ElectroAI] Scanning serial ports...");
      exec(
        `"${getPythonExe()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
        { timeout: 1e4 },
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
              stdout
            );
            resolve([]);
          }
        }
      );
    });
  });
  ipcMain.handle("hardware:checkChip", async (_, { port }) => {
    console.log(`[ElectroAI] Checking chip on ${port}...`);
    return new Promise((resolve) => {
      if (monitorProcess) {
        monitorProcess.kill();
        monitorProcess = null;
      }
      let resolved = false;
      const done = (result) => {
        if (!resolved) {
          resolved = true;
          console.log("[ElectroAI] checkChip result:", result);
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
          const msg = errBuf.trim() || `Could not open ${port}. Check USB cable, drivers, and close other serial tools (Thonny, Arduino IDE, PuTTY).`;
          done({ connected: false, message: msg });
        }
      });
      const timer = setTimeout(() => {
        ser.kill();
        done({
          connected: false,
          message: `Timeout — no response from ${port}. Is the port correct?`
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
    async (event, { code, port, language, boardId, deviceName, mode = "flash" }) => {
      await stopMonitorNative();
      return new Promise((resolve) => {
        const tempFilePath = path.join(os.tmpdir(), `electro_temp_${Date.now()}.py`);
        try {
          fs.writeFileSync(tempFilePath, code, "utf-8");
        } catch {
          resolve({ success: false, message: "Failed to write temp file" });
          return;
        }
        setTimeout(() => {
          const scriptPath = path.join(
            path.join(process.env.APP_ROOT, ".."),
            "firmware-tools",
            "core",
            "uploader.py"
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
            win == null ? void 0 : win.webContents.send("terminal-output", str);
          });
          flashProc.stderr.on("data", (data) => {
            const str = data.toString();
            fullOutput += str;
            win == null ? void 0 : win.webContents.send("terminal-output", str);
          });
          flashProc.on("close", (code2) => {
            currentFlashProcess = null;
            try {
              fs.unlinkSync(tempFilePath);
            } catch (e) {
            }
            if (code2 !== 0) {
              const msg = fullOutput.trim() || "Process exited with error";
              resolve({
                success: false,
                message: msg.includes("ERROR:") ? msg.split("ERROR:")[1].trim() : msg
              });
            } else {
              resolve({
                success: true,
                message: "Success"
              });
            }
          });
          flashProc.on("error", (err) => {
            currentFlashProcess = null;
            resolve({ success: false, message: err.message });
          });
        }, 1500);
      });
    }
  );
  ipcMain.handle(
    "hardware:startMonitor",
    async (event, { port, baudRate = 115200 }) => {
      var _a, _b;
      if (monitorProcess)
        return { success: false, message: "Monitor already running" };
      const scriptPath = path.join(
        projectRoot,
        "firmware-tools",
        "serial",
        "monitor.py"
      );
      monitorProcess = spawn(getPythonExe(), [
        scriptPath,
        "--port",
        port,
        "--baud",
        baudRate.toString()
      ]);
      (_a = monitorProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        if (win) {
          win.webContents.send("terminal-output", data.toString().trim());
        }
      });
      (_b = monitorProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
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
  ipcMain.handle("hardware:listFiles", async (_event, { port }) => {
    return withPortAccess(port, () => {
      return new Promise((resolve) => {
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py"
        );
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
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py"
        );
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
          const scriptPath = path.join(
            projectRoot,
            "firmware-tools",
            "core",
            "fs_manager.py"
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
              tempFilePath
            ],
            { timeout: 3e4 },
            (error, stdout, stderr) => {
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
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py"
        );
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
        const scriptPath = path.join(
          projectRoot,
          "firmware-tools",
          "core",
          "fs_manager.py"
        );
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
  ipcMain.handle("ai:generate", async (_event, _args) => {
    return {
      code: "# Generated by ElectroAI\nfrom machine import Pin\nled = Pin(25, Pin.OUT)\nled.toggle()",
      wiring: "Connect your component according to the standard pinout."
    };
  });
}
app.on("window-all-closed", () => {
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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
