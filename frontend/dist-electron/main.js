import { app as S, BrowserWindow as N, ipcMain as f, dialog as A, shell as K, safeStorage as j } from "electron";
import { fileURLToPath as z } from "node:url";
import c from "node:path";
import { exec as E, spawn as C, execFile as k, execSync as D } from "node:child_process";
import a from "node:fs";
import T from "node:os";
import R from "node:http";
import O from "node:https";
const L = c.dirname(z(import.meta.url));
process.env.APP_ROOT = c.join(L, "..");
const v = process.env.VITE_DEV_SERVER_URL, ne = c.join(process.env.APP_ROOT, "dist-electron"), B = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = v ? c.join(process.env.APP_ROOT, "public") : B;
let u, h = null, _ = null;
const V = S.requestSingleInstanceLock();
V || S.quit();
function $(m) {
  return S.isPackaged ? c.join(process.resourcesPath, m) : c.join(process.env.APP_ROOT, "..", m);
}
function P() {
  if (process.platform === "win32") {
    const m = c.join(T.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    return a.existsSync(m) ? m : "python";
  }
  try {
    return D("python3 --version", { stdio: "ignore" }), "python3";
  } catch {
    return "python";
  }
}
function G(m) {
  if (!m) return "";
  try {
    return j.isEncryptionAvailable() ? `enc:${j.encryptString(m).toString("base64")}` : (console.warn("[Security] safeStorage not available. Storing in plain-text."), m);
  } catch (s) {
    return console.error("[Security] Encryption failed:", s), m;
  }
}
function M(m) {
  if (!m || !m.startsWith("enc:")) return m;
  try {
    if (j.isEncryptionAvailable()) {
      const s = m.substring(4), e = Buffer.from(s, "base64");
      return j.decryptString(e);
    }
    return m;
  } catch (s) {
    return console.error("[Security] Decryption failed:", s), m;
  }
}
function U() {
  u = new N({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: !1,
    // Frameless window
    icon: S.isPackaged ? c.join(process.resourcesPath, "icon.ico") : c.join(process.env.VITE_PUBLIC, "icon.ico"),
    webPreferences: {
      preload: c.join(L, "preload.js"),
      // Vite plugin-electron compiles preload.ts to .js
      contextIsolation: !0,
      // Security requirement
      nodeIntegration: !1
    }
  }), u.webContents.on("did-finish-load", () => {
    u?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? u.loadURL(v) : u.loadFile(c.join(B, "index.html"));
}
async function b() {
  return new Promise((m) => {
    if (!h) return m(!0);
    const s = h;
    h = null;
    let e = !1;
    const t = () => {
      e || (e = !0, setTimeout(() => m(!0), 500));
    };
    if (s.once("close", t), s.once("exit", t), s.once("error", t), process.platform === "win32" && s.pid) {
      try {
        D(`taskkill /pid ${s.pid} /T /F`, { stdio: "ignore" });
      } catch {
      }
      setTimeout(t, 1e3);
    } else {
      try {
        s.kill("SIGINT");
      } catch {
      }
      setTimeout(() => {
        try {
          s.kill("SIGTERM");
        } catch {
        }
      }, 1500), setTimeout(() => {
        try {
          s.kill("SIGKILL");
        } catch {
        }
        t();
      }, 3e3);
    }
  });
}
async function I(m, s) {
  return await b(), await s();
}
function q() {
  f.handle("dialog:openFolder", async () => {
    const { canceled: s, filePaths: e } = await A.showOpenDialog({
      properties: ["openDirectory"]
    });
    return s ? null : e[0];
  }), f.handle("dialog:openFile", async () => {
    const { canceled: s, filePaths: e } = await A.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Code Files", extensions: ["py", "js", "ts", "json", "html", "css", "md", "txt", "c", "cpp", "h", "hpp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (!s && e.length > 0)
      try {
        const t = e[0], n = a.readFileSync(t, "utf-8");
        return {
          path: t,
          name: c.basename(t),
          content: n
        };
      } catch (t) {
        return { error: t.message };
      }
    return null;
  }), f.handle("fs:readDir", async (s, { dirPath: e }) => {
    try {
      return a.existsSync(e) ? a.statSync(e).isDirectory() ? a.readdirSync(e).map((r) => {
        const o = c.join(e, r);
        let l = !1;
        try {
          l = a.statSync(o).isDirectory();
        } catch {
        }
        return {
          id: o,
          name: r,
          type: l ? "folder" : "file",
          filePath: o,
          children: l ? [] : void 0
          // Empty array signifies an unloaded folder
        };
      }).sort((r, o) => r.type === o.type ? r.name.localeCompare(o.name) : r.type === "folder" ? -1 : 1) : [] : [];
    } catch {
      return [];
    }
  }), f.handle("fs:readFile", async (s, { filePath: e }) => {
    try {
      return a.readFileSync(e, "utf-8");
    } catch {
      return null;
    }
  }), f.handle("fs:createFile", async (s, { filePath: e, content: t = "" }) => {
    try {
      return a.writeFileSync(e, t, "utf-8"), { success: !0 };
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), f.handle("fs:createFolder", async (s, { folderPath: e }) => {
    try {
      return a.mkdirSync(e, { recursive: !0 }), { success: !0 };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), f.handle("fs:delete", async (s, { filePath: e }) => {
    try {
      return a.rmSync(e, { recursive: !0, force: !0 }), { success: !0 };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), f.handle("fs:rename", async (s, { oldPath: e, newPath: t }) => {
    try {
      return a.renameSync(e, t), { success: !0 };
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), f.handle("saveApiSettings", async (s, e) => {
    try {
      const t = c.join(S.getPath("userData"), "config");
      a.existsSync(t) || a.mkdirSync(t, { recursive: !0 });
      const n = c.join(t, "settings.json"), r = {
        ...e,
        apiKey: G(e.apiKey),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return a.writeFileSync(n, JSON.stringify(r, null, 2), "utf-8"), { success: !0, path: n };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), f.handle("loadApiSettings", async () => {
    try {
      const s = c.join(S.getPath("userData"), "config", "settings.json");
      if (!a.existsSync(s)) return null;
      const e = a.readFileSync(s, "utf-8"), t = JSON.parse(e);
      return {
        ...t,
        apiKey: M(t.apiKey)
      };
    } catch {
      return null;
    }
  }), f.handle("hardware:listPorts", async () => new Promise((s) => {
    E(
      `"${P()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
      { timeout: 1e4 },
      (e, t) => {
        if (e) {
          s([]);
          return;
        }
        try {
          const n = JSON.parse(t.trim());
          s(n);
        } catch {
          console.error(
            "[ElectroAI] Could not parse port list. stdout:",
            t
          ), s([]);
        }
      }
    );
  })), f.handle("hardware:checkChip", async (s, { port: e }) => (await b(), new Promise((t) => {
    let n = !1;
    const r = (g) => {
      n || (n = !0, t(g));
    }, o = C(P(), [
      "-c",
      `
import serial, sys, time
try:
    s = serial.Serial('${e}', 115200, timeout=2)
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
    let l = "", d = "";
    o.stdout.on("data", (g) => l += g.toString()), o.stderr.on("data", (g) => d += g.toString()), o.on("error", (g) => {
      console.error("[ElectroAI] spawn error:", g.message), r({
        connected: !1,
        message: "Python not found. Install Python and pyserial."
      });
    }), o.on("close", (g) => {
      if (console.log(
        `[ElectroAI] checkChip python exited code=${g}, stdout="${l.trim()}", stderr="${d.trim()}"`
      ), l.trim() === "ok")
        r({ connected: !0 });
      else {
        const y = d.trim() || `Could not open ${e}. Check USB cable, drivers, and close other serial tools.`;
        r({ connected: !1, message: y });
      }
    });
    const p = setTimeout(() => {
      o.kill(), r({
        connected: !1,
        message: `Timeout — no response from ${e}.`
      });
    }, 8e3);
    o.on("close", () => clearTimeout(p));
  }))), f.handle("dialog:saveFile", async (s, { content: e, defaultName: t }) => {
    const { canceled: n, filePath: r } = await A.showSaveDialog({
      defaultPath: t ?? "untitled.py",
      filters: [
        { name: "Python", extensions: ["py"] },
        { name: "C/C++", extensions: ["c", "cpp", "ino", "h"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (n || !r) return { success: !1 };
    try {
      return a.writeFileSync(r, e, "utf-8"), { success: !0, filePath: r, path: r };
    } catch (o) {
      return { success: !1, message: o.message };
    }
  }), f.handle(
    "hardware:flash",
    async (s, { code: e, port: t, language: n, boardId: r, deviceName: o, mode: l }) => (await b(), await new Promise((d) => {
      const p = `
import serial, sys, time
for attempt in range(5):
    try:
        s = serial.Serial('${t}', 115200, timeout=0.5)
        s.write(b'\\r\\x03\\x03\\x03')  
        time.sleep(0.2)
        s.close()
        break
    except Exception:
        time.sleep(0.2)
`;
      C(P(), ["-c", p]).on("close", d);
    }), new Promise((d) => {
      const p = c.join(T.tmpdir(), "electro_temp.py");
      try {
        a.writeFileSync(p, e, "utf-8");
      } catch {
        d({ success: !1, message: "Failed to write temp file" });
        return;
      }
      setTimeout(() => {
        const y = [
          $(c.join("firmware-tools", "core", "uploader.py")),
          "--port",
          t,
          "--file",
          p,
          "--language",
          n,
          "--board-id",
          r ?? "arduino:avr:uno"
        ];
        if (o && y.push("--device-name", o), l && y.push("--mode", l), l === "run") {
          const i = C(P(), y);
          h = i, i.stdout?.on("data", (w) => {
            u && u.webContents.send("terminal-output", w.toString("utf8"));
          }), i.stderr?.on("data", (w) => {
            u && u.webContents.send("terminal-output", w.toString("utf8"));
          }), i.on("close", (w) => {
            h === i && (h = null), d(w === 0 || w === null ? { success: !0, message: "Execution finished" } : { success: !1, message: "" });
          });
        } else
          k(
            P(),
            y,
            { timeout: 6e4 },
            (i, w, x) => {
              if (i) {
                d({
                  success: !1,
                  message: x.trim() || w.trim() || i.message
                });
                return;
              }
              const F = $(c.join("firmware-tools", "serial", "monitor.py"));
              h = C(P(), [
                F,
                "--port",
                t,
                "--baud",
                "115200"
              ]), h.stdout?.on("data", (W) => {
                u && u.webContents.send("terminal-output", W.toString("utf8"));
              }), h.stderr?.on("data", () => {
              }), h.on("close", () => {
                h = null;
              }), d({
                success: !0,
                message: w.trim() || "Upload complete — device running"
              });
            }
          );
      }, 1e3);
    }))
  ), f.handle(
    "hardware:startMonitor",
    async (s, { port: e, baudRate: t = 115200 }) => {
      if (h)
        return { success: !1, message: "Monitor already running" };
      const n = $(c.join("firmware-tools", "serial", "monitor.py"));
      return h = C(P(), [
        n,
        "--port",
        e,
        "--baud",
        t.toString()
      ]), h.stdout?.on("data", (r) => {
        u && u.webContents.send("terminal-output", r.toString("utf8"));
      }), h.stderr?.on("data", (r) => {
        console.error(`Monitor Error: ${r}`);
      }), h.on("close", () => {
        h = null;
      }), { success: !0 };
    }
  ), f.handle("hardware:stopMonitor", async () => (await b(), { success: !0 }));
  let m = !1;
  f.handle("hardware:stopExecution", async (s, { port: e }) => m ? { success: !1, message: "Stop already in progress" } : (m = !0, await b(), new Promise((t) => {
    const n = `
import serial, sys, time

success = False
for attempt in range(15):
    try:
        s = serial.Serial('${e}', 115200, timeout=1)
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
    C(P(), ["-c", n]).on("close", () => {
      const o = $(c.join("firmware-tools", "serial", "monitor.py"));
      h = C(P(), [o, "--port", e, "--baud", "115200"]), h.stdout?.on("data", (l) => {
        u && u.webContents.send("terminal-output", l.toString("utf8"));
      }), h.stderr?.on("data", (l) => {
        console.error(`Monitor Error: ${l}`);
      }), h.on("close", () => {
        h = null;
      }), m = !1, t({ success: !0 });
    });
  }))), f.handle("hardware:listFiles", async (s, { port: e }) => I(e, () => new Promise((t) => {
    const n = $(c.join("firmware-tools", "core", "fs_manager.py"));
    E(
      `"${P()}" "${n}" --port ${e} --action list`,
      { timeout: 3e4 },
      (r, o) => {
        if (r) {
          console.error("[ElectroAI] listFiles error:", r.message), t({ error: "Failed to read device" });
          return;
        }
        try {
          const l = JSON.parse(o.trim());
          t(l);
        } catch {
          console.error("[ElectroAI] listFiles parse error:", o), t({ error: "Invalid data from device" });
        }
      }
    );
  }))), f.handle("hardware:readFile", async (s, { port: e, filePath: t }) => I(e, () => new Promise((n) => {
    const r = $(c.join("firmware-tools", "core", "fs_manager.py"));
    E(
      `"${P()}" "${r}" --port ${e} --action read --path "${t}"`,
      { timeout: 3e4 },
      (o, l, d) => {
        if (o) {
          console.error("[ElectroAI] readFile error:", o.message), n({ error: d || o.message });
          return;
        }
        try {
          const p = JSON.parse(l.trim());
          n(p);
        } catch {
          console.error("[ElectroAI] readFile parse error:", l), n({ error: "Invalid response from device" });
        }
      }
    );
  }))), f.handle(
    "hardware:writeFile",
    async (s, { port: e, filePath: t, content: n }) => I(e, () => new Promise((r) => {
      const o = c.join(
        T.tmpdir(),
        "electro_write_temp_" + Date.now() + ".py"
      );
      try {
        a.writeFileSync(o, n, "utf-8");
      } catch {
        r({ success: !1, message: "Temp file error" });
        return;
      }
      const l = $(c.join("firmware-tools", "core", "fs_manager.py"));
      k(
        P(),
        [
          l,
          "--port",
          e,
          "--action",
          "write",
          "--path",
          t,
          "--localpath",
          o
        ],
        { timeout: 3e4 },
        (d, p) => {
          try {
            a.unlinkSync(o);
          } catch {
          }
          d ? (console.error("[ElectroAI] writeFile error:", p || d.message), r({ success: !1, message: p || d.message })) : (console.log("[ElectroAI] writeFile success:", t), r({ success: !0 }));
        }
      );
    }))
  ), f.handle("hardware:deleteFile", async (s, { port: e, filePath: t }) => I(e, () => new Promise((n) => {
    const r = $(c.join("firmware-tools", "core", "fs_manager.py"));
    E(
      `"${P()}" "${r}" --port ${e} --action delete --path "${t}"`,
      { timeout: 3e4 },
      (o, l) => {
        if (o) {
          n({ success: !1, message: "Failed to delete device file" });
          return;
        }
        try {
          const d = JSON.parse(l.trim());
          n(d);
        } catch {
          n({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), f.handle("hardware:renameFile", async (s, { port: e, oldPath: t, newPath: n }) => I(e, () => new Promise((r) => {
    const o = $(c.join("firmware-tools", "core", "fs_manager.py"));
    E(
      `"${P()}" "${o}" --port ${e} --action rename --path "${t}" --newpath "${n}"`,
      { timeout: 3e4 },
      (l, d) => {
        if (l) {
          r({ success: !1, message: "Failed to rename device file" });
          return;
        }
        try {
          const p = JSON.parse(d.trim());
          r(p);
        } catch {
          r({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), f.handle("ai:generate", async (s, e) => {
    try {
      const t = c.join(S.getPath("userData"), "config", "settings.json");
      if (!a.existsSync(t))
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      const n = a.readFileSync(t, "utf-8"), r = JSON.parse(n), o = M(r.apiKey), l = JSON.stringify({
        ...e,
        apiConfig: {
          ...r,
          apiKey: o
        }
      });
      return {
        success: !0,
        response_text: (await new Promise((p, g) => {
          const y = R.request(
            {
              hostname: "127.0.0.1",
              port: 4e3,
              path: "/api/v1/ai/generate",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(l)
              }
            },
            (i) => {
              let w = "";
              i.on("data", (x) => w += x), i.on("end", () => {
                try {
                  const x = JSON.parse(w);
                  i.statusCode >= 200 && i.statusCode < 300 ? p(x) : g(new Error(x.error || `MCP Server error: ${i.statusCode}`));
                } catch {
                  g(new Error(`MCP Server returned invalid JSON (status ${i.statusCode})`));
                }
              });
            }
          );
          y.on("error", (i) => {
            g(new Error(`Cannot reach MCP Server: ${i.message}. Is it running?`));
          }), y.write(l), y.end();
        })).data
      };
    } catch (t) {
      return console.error("[AiProxy] Generation failed:", t), { success: !1, error: { type: "RUNTIME", message: t.message } };
    }
  }), f.handle("window:minimize", () => {
    u?.minimize();
  }), f.handle("window:maximize", () => {
    u?.isMaximized() ? u.unmaximize() : u?.maximize();
  }), f.handle("window:close", () => {
    u?.close();
  }), f.handle("terminal:sendInput", async (s, e) => {
    if (h && h.stdin)
      try {
        return h.stdin.write(e), { success: !0 };
      } catch (t) {
        return { success: !1, message: t.message };
      }
    return { success: !1, message: "No active serial monitor" };
  }), f.handle("firmware:listVolumes", async () => {
    try {
      if (process.platform === "win32")
        return new Promise((s) => {
          E('wmic logicaldisk where "DriveType=2" get DeviceID,VolumeName /format:csv', (e, t) => {
            if (e) {
              s([]);
              return;
            }
            const r = t.trim().split(`
`).filter((o) => o.includes(",")).slice(1).map((o) => {
              const l = o.trim().split(","), d = l[1] || "", p = l[2] || "Removable Disk";
              return { path: d + "\\", label: `${p} (${d})` };
            }).filter((o) => o.path.length > 1);
            s(r);
          });
        });
      if (process.platform === "darwin") {
        const s = "/Volumes";
        return a.existsSync(s) ? a.readdirSync(s).map((t) => ({
          path: c.join(s, t),
          label: t
        })) : [];
      } else {
        const s = T.userInfo().username, e = [`/media/${s}`, `/run/media/${s}`], t = [];
        for (const n of e)
          if (a.existsSync(n))
            for (const r of a.readdirSync(n))
              t.push({ path: c.join(n, r), label: r });
        return t;
      }
    } catch {
      return [];
    }
  }), f.handle("firmware:install", async (s, { sourcePath: e, targetVolume: t }) => {
    try {
      if (!a.existsSync(e))
        return { success: !1, message: "Firmware file not found: " + e };
      const n = c.basename(e), r = c.join(t, n), l = a.statSync(e).size;
      if (l === 0)
        return { success: !1, message: "Firmware file is empty" };
      const d = a.createReadStream(e), p = a.createWriteStream(r);
      let g = 0;
      return d.on("data", (y) => {
        g += y.length;
        const i = Math.round(g / l * 100);
        u && u.webContents.send("firmware-progress", {
          percent: i,
          message: `Copying ${n}... ${i}%`
        });
      }), new Promise((y) => {
        p.on("finish", () => {
          u && u.webContents.send("firmware-progress", {
            percent: 100,
            message: "Firmware installed successfully!",
            done: !0
          }), y({ success: !0 });
        }), p.on("error", (i) => {
          u && u.webContents.send("firmware-progress", {
            percent: 0,
            message: i.message,
            error: i.message
          }), y({ success: !1, message: i.message });
        }), d.on("error", (i) => {
          u && u.webContents.send("firmware-progress", {
            percent: 0,
            message: i.message,
            error: i.message
          }), y({ success: !1, message: i.message });
        }), d.pipe(p);
      });
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), f.handle("shell:openExternal", async (s, e) => {
    try {
      return await K.openExternal(e), { success: !0 };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), f.handle("firmware:download", async (s, { url: e, fileName: t }) => {
    try {
      const n = c.join(S.getPath("userData"), "firmware-cache");
      a.existsSync(n) || a.mkdirSync(n, { recursive: !0 });
      const r = c.join(n, t);
      return a.existsSync(r) && a.statSync(r).size > 0 ? (console.log(`[Firmware] Using cached: ${r}`), u && u.webContents.send("firmware-progress", {
        percent: 100,
        message: "Using cached firmware file..."
      }), { success: !0, filePath: r }) : new Promise((o) => {
        const l = (p, g = 0) => {
          if (g > 5) {
            o({ success: !1, message: "Too many redirects" });
            return;
          }
          (p.startsWith("https") ? O : R).get(p, (i) => {
            if (i.statusCode >= 300 && i.statusCode < 400 && i.headers.location) {
              const w = i.headers.location;
              (w.startsWith("https") ? O : R).get(w, (F) => {
                if (F.statusCode >= 300 && F.statusCode < 400 && F.headers.location) {
                  l(F.headers.location, g + 2);
                  return;
                }
                d(F);
              }).on("error", (F) => {
                o({ success: !1, message: `Download failed: ${F.message}` });
              });
              return;
            }
            d(i);
          }).on("error", (i) => {
            o({ success: !1, message: `Download failed: ${i.message}` });
          });
        }, d = (p) => {
          if (p.statusCode !== 200) {
            o({ success: !1, message: `Server returned ${p.statusCode}` });
            return;
          }
          const g = parseInt(p.headers["content-length"] || "0", 10);
          let y = 0;
          const i = a.createWriteStream(r);
          p.on("data", (w) => {
            if (y += w.length, g > 0) {
              const x = Math.round(y / g * 100);
              u && u.webContents.send("firmware-progress", {
                percent: x,
                message: `Downloading ${t}... ${(y / 1024 / 1024).toFixed(1)} MB`
              });
            } else
              u && u.webContents.send("firmware-progress", {
                percent: -1,
                message: `Downloading ${t}... ${(y / 1024 / 1024).toFixed(1)} MB`
              });
          }), p.pipe(i), i.on("finish", () => {
            i.close(), console.log(`[Firmware] Downloaded: ${r}`), o({ success: !0, filePath: r });
          }), i.on("error", (w) => {
            a.unlinkSync(r), o({ success: !1, message: w.message });
          });
        };
        l(e);
      });
    } catch (n) {
      return { success: !1, message: n.message };
    }
  });
}
function H() {
  const m = $(c.join("mcp-server", "src", "server.js"));
  if (a.existsSync(m)) {
    console.log(`[ElectroAI] Starting MCP Server at ${m}...`), _ = C(process.execPath, [m], {
      cwd: c.dirname(c.dirname(m)),
      stdio: "pipe",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: "4000", WS_PORT: "4001" }
    });
    const s = c.join(S.getPath("userData"), "mcp_debug.log");
    a.appendFileSync(s, `
--- STARTING MCP SERVER at ${(/* @__PURE__ */ new Date()).toISOString()} ---
`), a.appendFileSync(s, `mcpPath: ${m}
cwd: ${c.dirname(c.dirname(m))}
`), _.stdout?.on("data", (e) => {
      console.log(`[MCP] ${e}`), a.appendFileSync(s, `[STDOUT] ${e}`);
    }), _.stderr?.on("data", (e) => {
      console.error(`[MCP] ${e}`), a.appendFileSync(s, `[STDERR] ${e}`);
    }), _.on("error", (e) => {
      console.error("[ElectroAI] Failed to start MCP Server:", e), a.appendFileSync(s, `[SPAWN ERROR] ${e.message}
${e.stack}
`);
    }), _.on("close", (e) => {
      console.log(`[ElectroAI] MCP Server exited with code ${e}`), a.appendFileSync(s, `[EXIT] Code ${e}
`);
    });
  } else
    console.warn(`[ElectroAI] MCP Server not found at ${m}`);
}
function J() {
  if (h)
    try {
      process.platform === "win32" && h.pid ? D(`taskkill /pid ${h.pid} /T /F`, { stdio: "ignore" }) : h.kill("SIGKILL");
    } catch {
    }
  if (_)
    try {
      process.platform === "win32" && _.pid ? D(`taskkill /pid ${_.pid} /T /F`, { stdio: "ignore" }) : _.kill("SIGKILL");
    } catch {
    }
}
S.on("before-quit", () => {
  J();
});
S.on("window-all-closed", () => {
  J(), process.platform !== "darwin" && (S.quit(), u = null);
});
S.on("second-instance", () => {
  u && (u.isMinimized() && u.restore(), u.focus());
});
S.on("activate", () => {
  N.getAllWindows().length === 0 && U();
});
V && S.whenReady().then(() => {
  q(), H(), U();
});
export {
  ne as MAIN_DIST,
  B as RENDERER_DIST,
  v as VITE_DEV_SERVER_URL
};
