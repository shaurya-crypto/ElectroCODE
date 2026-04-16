import { app as S, BrowserWindow as N, ipcMain as f, dialog as A, shell as z, safeStorage as b } from "electron";
import { fileURLToPath as G } from "node:url";
import c from "node:path";
import { exec as I, spawn as x, execFile as k, execSync as D } from "node:child_process";
import a from "node:fs";
import j from "node:os";
import R from "node:http";
import v from "node:https";
const L = c.dirname(G(import.meta.url));
process.env.APP_ROOT = c.join(L, "..");
const O = process.env.VITE_DEV_SERVER_URL, ne = c.join(process.env.APP_ROOT, "dist-electron"), B = c.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = O ? c.join(process.env.APP_ROOT, "public") : B;
let u, h = null, _ = null;
const U = S.requestSingleInstanceLock();
U || S.quit();
function $(p) {
  return S.isPackaged ? c.join(process.resourcesPath, "_internal", p) : c.join(process.env.APP_ROOT, "..", p);
}
function P() {
  if (process.platform === "win32") {
    const p = c.join(j.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    return a.existsSync(p) ? p : "python";
  }
  try {
    return D("python3 --version", { stdio: "ignore" }), "python3";
  } catch {
    return "python";
  }
}
function q(p) {
  if (!p) return "";
  try {
    return b.isEncryptionAvailable() ? `enc:${b.encryptString(p).toString("base64")}` : (console.warn("[Security] safeStorage not available. Storing in plain-text."), p);
  } catch (r) {
    return console.error("[Security] Encryption failed:", r), p;
  }
}
function M(p) {
  if (!p || !p.startsWith("enc:")) return p;
  try {
    if (b.isEncryptionAvailable()) {
      const r = p.substring(4), t = Buffer.from(r, "base64");
      return b.decryptString(t);
    }
    return p;
  } catch (r) {
    return console.error("[Security] Decryption failed:", r), p;
  }
}
function V() {
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
  }), O ? u.loadURL(O) : u.loadFile(c.join(B, "index.html"));
}
async function T() {
  return new Promise((p) => {
    if (!h) return p(!0);
    const r = h;
    h = null;
    let t = !1;
    const e = () => {
      t || (t = !0, setTimeout(() => p(!0), 500));
    };
    if (r.once("close", e), r.once("exit", e), r.once("error", e), process.platform === "win32" && r.pid) {
      try {
        D(`taskkill /pid ${r.pid} /T /F`, { stdio: "ignore" });
      } catch {
      }
      setTimeout(e, 1e3);
    } else {
      try {
        r.kill("SIGINT");
      } catch {
      }
      setTimeout(() => {
        try {
          r.kill("SIGTERM");
        } catch {
        }
      }, 1500), setTimeout(() => {
        try {
          r.kill("SIGKILL");
        } catch {
        }
        e();
      }, 3e3);
    }
  });
}
async function C(p, r) {
  return await T(), await r();
}
function H() {
  f.handle("dialog:openFolder", async () => {
    const { canceled: r, filePaths: t } = await A.showOpenDialog({
      properties: ["openDirectory"]
    });
    return r ? null : t[0];
  }), f.handle("dialog:openFile", async () => {
    const { canceled: r, filePaths: t } = await A.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Code Files", extensions: ["py", "js", "ts", "json", "html", "css", "md", "txt", "c", "cpp", "h", "hpp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (!r && t.length > 0)
      try {
        const e = t[0], s = a.readFileSync(e, "utf-8");
        return {
          path: e,
          name: c.basename(e),
          content: s
        };
      } catch (e) {
        return { error: e.message };
      }
    return null;
  }), f.handle("fs:readDir", async (r, { dirPath: t }) => {
    try {
      return a.existsSync(t) ? a.statSync(t).isDirectory() ? a.readdirSync(t).map((n) => {
        const o = c.join(t, n);
        let l = !1;
        try {
          l = a.statSync(o).isDirectory();
        } catch {
        }
        return {
          id: o,
          name: n,
          type: l ? "folder" : "file",
          filePath: o,
          children: l ? [] : void 0
          // Empty array signifies an unloaded folder
        };
      }).sort((n, o) => n.type === o.type ? n.name.localeCompare(o.name) : n.type === "folder" ? -1 : 1) : [] : [];
    } catch {
      return [];
    }
  }), f.handle("fs:readFile", async (r, { filePath: t }) => {
    try {
      return a.readFileSync(t, "utf-8");
    } catch {
      return null;
    }
  }), f.handle("fs:createFile", async (r, { filePath: t, content: e = "" }) => {
    try {
      return a.writeFileSync(t, e, "utf-8"), { success: !0 };
    } catch (s) {
      return { success: !1, message: s.message };
    }
  }), f.handle("fs:createFolder", async (r, { folderPath: t }) => {
    try {
      return a.mkdirSync(t, { recursive: !0 }), { success: !0 };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), f.handle("fs:delete", async (r, { filePath: t }) => {
    try {
      return a.rmSync(t, { recursive: !0, force: !0 }), { success: !0 };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), f.handle("fs:rename", async (r, { oldPath: t, newPath: e }) => {
    try {
      return a.renameSync(t, e), { success: !0 };
    } catch (s) {
      return { success: !1, message: s.message };
    }
  }), f.handle("saveApiSettings", async (r, t) => {
    try {
      const e = c.join(S.getPath("userData"), "config");
      a.existsSync(e) || a.mkdirSync(e, { recursive: !0 });
      const s = c.join(e, "settings.json"), n = {
        ...t,
        apiKey: q(t.apiKey),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return a.writeFileSync(s, JSON.stringify(n, null, 2), "utf-8"), { success: !0, path: s };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), f.handle("loadApiSettings", async () => {
    try {
      const r = c.join(S.getPath("userData"), "config", "settings.json");
      if (!a.existsSync(r)) return null;
      const t = a.readFileSync(r, "utf-8"), e = JSON.parse(t);
      return {
        ...e,
        apiKey: M(e.apiKey)
      };
    } catch {
      return null;
    }
  }), f.handle("hardware:listPorts", async () => new Promise((r) => {
    I(
      `"${P()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
      { timeout: 1e4 },
      (t, e) => {
        if (t) {
          r([]);
          return;
        }
        try {
          const s = JSON.parse(e.trim());
          r(s);
        } catch {
          console.error(
            "[ElectroAI] Could not parse port list. stdout:",
            e
          ), r([]);
        }
      }
    );
  })), f.handle("hardware:checkChip", async (r, { port: t }) => (await T(), new Promise((e) => {
    let s = !1;
    const n = (g) => {
      s || (s = !0, e(g));
    }, o = x(P(), [
      "-c",
      `
import serial, sys, time
try:
    s = serial.Serial('${t}', 115200, timeout=2)
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
      console.error("[ElectroAI] spawn error:", g.message), n({
        connected: !1,
        message: "Python not found. Install Python and pyserial."
      });
    }), o.on("close", (g) => {
      if (console.log(
        `[ElectroAI] checkChip python exited code=${g}, stdout="${l.trim()}", stderr="${d.trim()}"`
      ), l.trim() === "ok")
        n({ connected: !0 });
      else {
        const y = d.trim() || `Could not open ${t}. Check USB cable, drivers, and close other serial tools.`;
        n({ connected: !1, message: y });
      }
    });
    const m = setTimeout(() => {
      o.kill(), n({
        connected: !1,
        message: `Timeout — no response from ${t}.`
      });
    }, 8e3);
    o.on("close", () => clearTimeout(m));
  }))), f.handle("dialog:saveFile", async (r, { content: t, defaultName: e }) => {
    const { canceled: s, filePath: n } = await A.showSaveDialog({
      defaultPath: e ?? "untitled.py",
      filters: [
        { name: "Python", extensions: ["py"] },
        { name: "C/C++", extensions: ["c", "cpp", "ino", "h"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (s || !n) return { success: !1 };
    try {
      return a.writeFileSync(n, t, "utf-8"), { success: !0, filePath: n, path: n };
    } catch (o) {
      return { success: !1, message: o.message };
    }
  }), f.handle(
    "hardware:flash",
    async (r, { code: t, port: e, language: s, boardId: n, deviceName: o, mode: l }) => (await T(), await new Promise((d) => {
      const m = `
import serial, sys, time
for attempt in range(5):
    try:
        s = serial.Serial('${e}', 115200, timeout=0.5)
        s.write(b'\\r\\x03\\x03\\x03')  
        time.sleep(0.2)
        s.close()
        break
    except Exception:
        time.sleep(0.2)
`;
      x(P(), ["-c", m]).on("close", d);
    }), new Promise((d) => {
      const m = c.join(j.tmpdir(), "electro_temp.py");
      try {
        a.writeFileSync(m, t, "utf-8");
      } catch {
        d({ success: !1, message: "Failed to write temp file" });
        return;
      }
      setTimeout(() => {
        const y = [
          $(c.join("firmware-tools", "core", "uploader.py")),
          "--port",
          e,
          "--file",
          m,
          "--language",
          s,
          "--board-id",
          n ?? "arduino:avr:uno"
        ];
        if (o && y.push("--device-name", o), l && y.push("--mode", l), l === "run") {
          const i = x(P(), y);
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
            (i, w, F) => {
              if (i) {
                d({
                  success: !1,
                  message: F.trim() || w.trim() || i.message
                });
                return;
              }
              const E = $(c.join("firmware-tools", "serial", "monitor.py"));
              h = x(P(), [
                E,
                "--port",
                e,
                "--baud",
                "115200"
              ]), h.stdout?.on("data", (K) => {
                u && u.webContents.send("terminal-output", K.toString("utf8"));
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
    async (r, { port: t, baudRate: e = 115200 }) => {
      if (h)
        return { success: !1, message: "Monitor already running" };
      const s = $(c.join("firmware-tools", "serial", "monitor.py"));
      return h = x(P(), [
        s,
        "--port",
        t,
        "--baud",
        e.toString()
      ]), h.stdout?.on("data", (n) => {
        u && u.webContents.send("terminal-output", n.toString("utf8"));
      }), h.stderr?.on("data", (n) => {
        console.error(`Monitor Error: ${n}`);
      }), h.on("close", () => {
        h = null;
      }), { success: !0 };
    }
  ), f.handle("hardware:stopMonitor", async () => (await T(), { success: !0 }));
  let p = !1;
  f.handle("hardware:stopExecution", async (r, { port: t }) => p ? { success: !1, message: "Stop already in progress" } : (p = !0, await T(), new Promise((e) => {
    const s = `
import serial, sys, time

success = False
for attempt in range(15):
    try:
        s = serial.Serial('${t}', 115200, timeout=1)
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
    x(P(), ["-c", s]).on("close", () => {
      const o = $(c.join("firmware-tools", "serial", "monitor.py"));
      h = x(P(), [o, "--port", t, "--baud", "115200"]), h.stdout?.on("data", (l) => {
        u && u.webContents.send("terminal-output", l.toString("utf8"));
      }), h.stderr?.on("data", (l) => {
        console.error(`Monitor Error: ${l}`);
      }), h.on("close", () => {
        h = null;
      }), p = !1, e({ success: !0 });
    });
  }))), f.handle("hardware:listFiles", async (r, { port: t }) => C(t, () => new Promise((e) => {
    const s = $(c.join("firmware-tools", "core", "fs_manager.py"));
    I(
      `"${P()}" "${s}" --port ${t} --action list`,
      { timeout: 3e4 },
      (n, o) => {
        if (n) {
          console.error("[ElectroAI] listFiles error:", n.message), e({ error: "Failed to read device" });
          return;
        }
        try {
          const l = JSON.parse(o.trim());
          e(l);
        } catch {
          console.error("[ElectroAI] listFiles parse error:", o), e({ error: "Invalid data from device" });
        }
      }
    );
  }))), f.handle("hardware:readFile", async (r, { port: t, filePath: e }) => C(t, () => new Promise((s) => {
    const n = $(c.join("firmware-tools", "core", "fs_manager.py"));
    I(
      `"${P()}" "${n}" --port ${t} --action read --path "${e}"`,
      { timeout: 3e4 },
      (o, l, d) => {
        if (o) {
          console.error("[ElectroAI] readFile error:", o.message), s({ error: d || o.message });
          return;
        }
        try {
          const m = JSON.parse(l.trim());
          s(m);
        } catch {
          console.error("[ElectroAI] readFile parse error:", l), s({ error: "Invalid response from device" });
        }
      }
    );
  }))), f.handle(
    "hardware:writeFile",
    async (r, { port: t, filePath: e, content: s }) => C(t, () => new Promise((n) => {
      const o = c.join(
        j.tmpdir(),
        "electro_write_temp_" + Date.now() + ".py"
      );
      try {
        a.writeFileSync(o, s, "utf-8");
      } catch {
        n({ success: !1, message: "Temp file error" });
        return;
      }
      const l = $(c.join("firmware-tools", "core", "fs_manager.py"));
      k(
        P(),
        [
          l,
          "--port",
          t,
          "--action",
          "write",
          "--path",
          e,
          "--localpath",
          o
        ],
        { timeout: 3e4 },
        (d, m) => {
          try {
            a.unlinkSync(o);
          } catch {
          }
          d ? (console.error("[ElectroAI] writeFile error:", m || d.message), n({ success: !1, message: m || d.message })) : (console.log("[ElectroAI] writeFile success:", e), n({ success: !0 }));
        }
      );
    }))
  ), f.handle("hardware:deleteFile", async (r, { port: t, filePath: e }) => C(t, () => new Promise((s) => {
    const n = $(c.join("firmware-tools", "core", "fs_manager.py"));
    I(
      `"${P()}" "${n}" --port ${t} --action delete --path "${e}"`,
      { timeout: 3e4 },
      (o, l) => {
        if (o) {
          s({ success: !1, message: "Failed to delete device file" });
          return;
        }
        try {
          const d = JSON.parse(l.trim());
          s(d);
        } catch {
          s({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), f.handle("hardware:renameFile", async (r, { port: t, oldPath: e, newPath: s }) => C(t, () => new Promise((n) => {
    const o = $(c.join("firmware-tools", "core", "fs_manager.py"));
    I(
      `"${P()}" "${o}" --port ${t} --action rename --path "${e}" --newpath "${s}"`,
      { timeout: 3e4 },
      (l, d) => {
        if (l) {
          n({ success: !1, message: "Failed to rename device file" });
          return;
        }
        try {
          const m = JSON.parse(d.trim());
          n(m);
        } catch {
          n({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), f.handle("ai:generate", async (r, t) => {
    try {
      const e = c.join(S.getPath("userData"), "config", "settings.json");
      if (!a.existsSync(e))
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      const s = a.readFileSync(e, "utf-8"), n = JSON.parse(s), o = M(n.apiKey), l = JSON.stringify({
        ...t,
        apiConfig: {
          ...n,
          apiKey: o
        }
      });
      return {
        success: !0,
        response_text: (await new Promise((m, g) => {
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
              i.on("data", (F) => w += F), i.on("end", () => {
                try {
                  const F = JSON.parse(w);
                  i.statusCode >= 200 && i.statusCode < 300 ? m(F) : g(new Error(F.error || `MCP Server error: ${i.statusCode}`));
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
    } catch (e) {
      return console.error("[AiProxy] Generation failed:", e), { success: !1, error: { type: "RUNTIME", message: e.message } };
    }
  }), f.handle("window:minimize", () => {
    u?.minimize();
  }), f.handle("window:maximize", () => {
    u?.isMaximized() ? u.unmaximize() : u?.maximize();
  }), f.handle("window:close", () => {
    u?.close();
  }), f.handle("terminal:sendInput", async (r, t) => {
    if (h && h.stdin)
      try {
        return h.stdin.write(t), { success: !0 };
      } catch (e) {
        return { success: !1, message: e.message };
      }
    return { success: !1, message: "No active serial monitor" };
  }), f.handle("firmware:listVolumes", async () => {
    try {
      if (process.platform === "win32")
        return new Promise((r) => {
          I('wmic logicaldisk where "DriveType=2" get DeviceID,VolumeName /format:csv', (t, e) => {
            if (t) {
              r([]);
              return;
            }
            const n = e.trim().split(`
`).filter((o) => o.includes(",")).slice(1).map((o) => {
              const l = o.trim().split(","), d = l[1] || "", m = l[2] || "Removable Disk";
              return { path: d + "\\", label: `${m} (${d})` };
            }).filter((o) => o.path.length > 1);
            r(n);
          });
        });
      if (process.platform === "darwin") {
        const r = "/Volumes";
        return a.existsSync(r) ? a.readdirSync(r).map((e) => ({
          path: c.join(r, e),
          label: e
        })) : [];
      } else {
        const r = j.userInfo().username, t = [`/media/${r}`, `/run/media/${r}`], e = [];
        for (const s of t)
          if (a.existsSync(s))
            for (const n of a.readdirSync(s))
              e.push({ path: c.join(s, n), label: n });
        return e;
      }
    } catch {
      return [];
    }
  }), f.handle("firmware:install", async (r, { sourcePath: t, targetVolume: e }) => {
    try {
      if (!a.existsSync(t))
        return { success: !1, message: "Firmware file not found: " + t };
      const s = c.basename(t), n = c.join(e, s), l = a.statSync(t).size;
      if (l === 0)
        return { success: !1, message: "Firmware file is empty" };
      const d = a.createReadStream(t), m = a.createWriteStream(n);
      let g = 0;
      return d.on("data", (y) => {
        g += y.length;
        const i = Math.round(g / l * 100);
        u && u.webContents.send("firmware-progress", {
          percent: i,
          message: `Copying ${s}... ${i}%`
        });
      }), new Promise((y) => {
        m.on("finish", () => {
          u && u.webContents.send("firmware-progress", {
            percent: 100,
            message: "Firmware installed successfully!",
            done: !0
          }), y({ success: !0 });
        }), m.on("error", (i) => {
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
        }), d.pipe(m);
      });
    } catch (s) {
      return { success: !1, message: s.message };
    }
  }), f.handle("shell:openExternal", async (r, t) => {
    try {
      return await z.openExternal(t), { success: !0 };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), f.handle("firmware:download", async (r, { url: t, fileName: e }) => {
    try {
      const s = c.join(S.getPath("userData"), "firmware-cache");
      a.existsSync(s) || a.mkdirSync(s, { recursive: !0 });
      const n = c.join(s, e);
      return a.existsSync(n) && a.statSync(n).size > 0 ? (console.log(`[Firmware] Using cached: ${n}`), u && u.webContents.send("firmware-progress", {
        percent: 100,
        message: "Using cached firmware file..."
      }), { success: !0, filePath: n }) : new Promise((o) => {
        const l = (m, g = 0) => {
          if (g > 5) {
            o({ success: !1, message: "Too many redirects" });
            return;
          }
          (m.startsWith("https") ? v : R).get(m, (i) => {
            if (i.statusCode >= 300 && i.statusCode < 400 && i.headers.location) {
              const w = i.headers.location;
              (w.startsWith("https") ? v : R).get(w, (E) => {
                if (E.statusCode >= 300 && E.statusCode < 400 && E.headers.location) {
                  l(E.headers.location, g + 2);
                  return;
                }
                d(E);
              }).on("error", (E) => {
                o({ success: !1, message: `Download failed: ${E.message}` });
              });
              return;
            }
            d(i);
          }).on("error", (i) => {
            o({ success: !1, message: `Download failed: ${i.message}` });
          });
        }, d = (m) => {
          if (m.statusCode !== 200) {
            o({ success: !1, message: `Server returned ${m.statusCode}` });
            return;
          }
          const g = parseInt(m.headers["content-length"] || "0", 10);
          let y = 0;
          const i = a.createWriteStream(n);
          m.on("data", (w) => {
            if (y += w.length, g > 0) {
              const F = Math.round(y / g * 100);
              u && u.webContents.send("firmware-progress", {
                percent: F,
                message: `Downloading ${e}... ${(y / 1024 / 1024).toFixed(1)} MB`
              });
            } else
              u && u.webContents.send("firmware-progress", {
                percent: -1,
                message: `Downloading ${e}... ${(y / 1024 / 1024).toFixed(1)} MB`
              });
          }), m.pipe(i), i.on("finish", () => {
            i.close(), console.log(`[Firmware] Downloaded: ${n}`), o({ success: !0, filePath: n });
          }), i.on("error", (w) => {
            a.unlinkSync(n), o({ success: !1, message: w.message });
          });
        };
        l(t);
      });
    } catch (s) {
      return { success: !1, message: s.message };
    }
  });
}
function J(p = 0) {
  const r = $(c.join("mcp-server", "src", "server.js")), t = $("mcp-server");
  if (a.existsSync(r)) {
    console.log(`[ElectroAI] Starting MCP Server at ${r}...`), _ = x(process.execPath, [r], {
      cwd: t,
      stdio: "pipe",
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: "4000",
        WS_PORT: "4001",
        // Ensure require() can find node_modules in the bundled mcp-server
        NODE_PATH: c.join(t, "node_modules")
      }
    });
    const e = c.join(S.getPath("userData"), "mcp_debug.log");
    a.appendFileSync(e, `
--- STARTING MCP SERVER at ${(/* @__PURE__ */ new Date()).toISOString()} ---
`), a.appendFileSync(e, `mcpPath: ${r}
cwd: ${t}
NODE_PATH: ${c.join(t, "node_modules")}
retry: ${p}
`), _.stdout?.on("data", (s) => {
      console.log(`[MCP] ${s}`), a.appendFileSync(e, `[STDOUT] ${s}`);
    }), _.stderr?.on("data", (s) => {
      console.error(`[MCP] ${s}`), a.appendFileSync(e, `[STDERR] ${s}`);
    }), _.on("error", (s) => {
      console.error("[ElectroAI] Failed to start MCP Server:", s), a.appendFileSync(e, `[SPAWN ERROR] ${s.message}
${s.stack}
`);
    }), _.on("close", (s) => {
      console.log(`[ElectroAI] MCP Server exited with code ${s}`), a.appendFileSync(e, `[EXIT] Code ${s}
`), _ = null, s !== 0 && s !== null && p < 3 && (console.log(`[ElectroAI] MCP crashed — restarting (attempt ${p + 1}/3)...`), a.appendFileSync(e, `[RESTART] Attempt ${p + 1}/3
`), setTimeout(() => J(p + 1), 2e3));
    });
  } else {
    console.warn(`[ElectroAI] MCP Server not found at ${r}`);
    const e = c.join(S.getPath("userData"), "mcp_debug.log");
    a.appendFileSync(e, `
[NOT FOUND] ${r}
resourcesPath: ${process.resourcesPath}
isPackaged: ${S.isPackaged}
`);
  }
}
function W() {
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
  W();
});
S.on("window-all-closed", () => {
  W(), process.platform !== "darwin" && (S.quit(), u = null);
});
S.on("second-instance", () => {
  u && (u.isMinimized() && u.restore(), u.focus());
});
S.on("activate", () => {
  N.getAllWindows().length === 0 && V();
});
U && S.whenReady().then(() => {
  H(), J(), V();
});
export {
  ne as MAIN_DIST,
  B as RENDERER_DIST,
  O as VITE_DEV_SERVER_URL
};
