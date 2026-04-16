import { app as w, BrowserWindow as B, ipcMain as f, dialog as R, shell as q, safeStorage as j } from "electron";
import { fileURLToPath as G } from "node:url";
import m from "node:path";
import { exec as b, spawn as v, execFile as M, execSync as L } from "node:child_process";
import a from "node:fs";
import I from "node:os";
import A from "node:http";
import k from "node:https";
import H from "node-pty";
import { SerialPort as T } from "serialport";
const U = m.dirname(G(import.meta.url));
process.env.APP_ROOT = m.join(U, "..");
const O = process.env.VITE_DEV_SERVER_URL, ce = m.join(process.env.APP_ROOT, "dist-electron"), V = m.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = O ? m.join(process.env.APP_ROOT, "public") : V;
let i, c = null, _ = null, $ = null;
const z = w.requestSingleInstanceLock();
z || w.quit();
function x(p) {
  return w.isPackaged ? m.join(process.resourcesPath, "_internal", p) : m.join(process.env.APP_ROOT, "..", p);
}
function E() {
  if (process.platform === "win32") {
    const p = m.join(I.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    return a.existsSync(p) ? p : "python";
  }
  try {
    return L("python3 --version", { stdio: "ignore" }), "python3";
  } catch {
    return "python";
  }
}
function X(p) {
  if (!p) return "";
  try {
    return j.isEncryptionAvailable() ? `enc:${j.encryptString(p).toString("base64")}` : (console.warn("[Security] safeStorage not available. Storing in plain-text."), p);
  } catch (r) {
    return console.error("[Security] Encryption failed:", r), p;
  }
}
function N(p) {
  if (!p || !p.startsWith("enc:")) return p;
  try {
    if (j.isEncryptionAvailable()) {
      const r = p.substring(4), t = Buffer.from(r, "base64");
      return j.decryptString(t);
    }
    return p;
  } catch (r) {
    return console.error("[Security] Decryption failed:", r), p;
  }
}
function J() {
  i = new B({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: !1,
    // Frameless window
    icon: w.isPackaged ? m.join(process.resourcesPath, "icon.ico") : m.join(process.env.VITE_PUBLIC, "icon.ico"),
    webPreferences: {
      preload: m.join(U, "preload.js"),
      // Vite plugin-electron compiles preload.ts to .js
      contextIsolation: !0,
      // Security requirement
      nodeIntegration: !1
    }
  }), i.webContents.on("did-finish-load", () => {
    i?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), O ? i.loadURL(O) : i.loadFile(m.join(V, "index.html"));
}
async function C() {
  return new Promise((p) => {
    if (!c) return p(!0);
    const r = c;
    c = null, r.isOpen ? r.close((t) => {
      t && console.error("[Serial] Error closing port:", t), setTimeout(() => p(!0), 200);
    }) : p(!0);
  });
}
async function D(p, r) {
  return await C(), await r();
}
function Q() {
  f.handle("dialog:openFolder", async () => {
    const { canceled: r, filePaths: t } = await R.showOpenDialog({
      properties: ["openDirectory"]
    });
    return r ? null : t[0];
  }), f.handle("dialog:openFile", async () => {
    const { canceled: r, filePaths: t } = await R.showOpenDialog({
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
          name: m.basename(e),
          content: s
        };
      } catch (e) {
        return { error: e.message };
      }
    return null;
  }), f.handle("fs:readDir", async (r, { dirPath: t }) => {
    try {
      return a.existsSync(t) ? a.statSync(t).isDirectory() ? a.readdirSync(t).map((n) => {
        const o = m.join(t, n);
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
      const e = m.join(w.getPath("userData"), "config");
      a.existsSync(e) || a.mkdirSync(e, { recursive: !0 });
      const s = m.join(e, "settings.json"), n = {
        ...t,
        apiKey: X(t.apiKey),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return a.writeFileSync(s, JSON.stringify(n, null, 2), "utf-8"), { success: !0, path: s };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), f.handle("loadApiSettings", async () => {
    try {
      const r = m.join(w.getPath("userData"), "config", "settings.json");
      if (!a.existsSync(r)) return null;
      const t = a.readFileSync(r, "utf-8"), e = JSON.parse(t);
      return {
        ...e,
        apiKey: N(e.apiKey)
      };
    } catch {
      return null;
    }
  }), f.handle("hardware:listPorts", async () => new Promise((r) => {
    b(
      `"${E()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
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
  })), f.handle("hardware:checkChip", async (r, { port: t }) => (await C(), new Promise((e) => {
    let s = !1;
    const n = (g) => {
      s || (s = !0, e(g));
    }, o = v(E(), [
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
    const h = setTimeout(() => {
      o.kill(), n({
        connected: !1,
        message: `Timeout — no response from ${t}.`
      });
    }, 8e3);
    o.on("close", () => clearTimeout(h));
  }))), f.handle("dialog:saveFile", async (r, { content: t, defaultName: e }) => {
    const { canceled: s, filePath: n } = await R.showSaveDialog({
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
    async (r, { code: t, port: e, language: s, boardId: n, deviceName: o, mode: l }) => (await C(), await new Promise((d) => {
      const h = `
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
      v(E(), ["-c", h]).on("close", d);
    }), new Promise(async (d) => {
      const h = m.join(I.tmpdir(), "electro_temp.py");
      try {
        a.writeFileSync(h, t, "utf-8");
      } catch {
        d({ success: !1, message: "Failed to write temp file" });
        return;
      }
      setTimeout(async () => {
        const y = [
          x(m.join("firmware-tools", "core", "uploader.py")),
          "--port",
          e,
          "--file",
          h,
          "--language",
          s,
          "--board-id",
          n ?? "arduino:avr:uno"
        ];
        if (o && y.push("--device-name", o), l && y.push("--mode", l), l === "run")
          try {
            c && await C(), c = new T({ path: e, baudRate: 115200 }), c.on("data", (u) => {
              i && i.webContents.send("terminal-output", u.toString("utf8"));
            }), c.on("error", () => {
              c = null;
            }), c.on("close", () => {
              c = null;
            }), c.on("open", () => {
              c.write(Buffer.from("\r", "utf-8")), setTimeout(() => {
                c.write(Buffer.from("", "utf-8")), setTimeout(() => {
                  c.write(Buffer.from(t, "utf-8")), setTimeout(() => {
                    c.write(Buffer.from("", "utf-8")), d({ success: !0, message: "Execution started natively" });
                  }, 100);
                }, 100);
              }, 200);
            });
          } catch (u) {
            d({ success: !1, message: u.message });
          }
        else
          M(
            E(),
            y,
            { timeout: 6e4 },
            async (u, S, F) => {
              if (u) {
                d({
                  success: !1,
                  message: F.trim() || S.trim() || u.message
                });
                return;
              }
              try {
                c && await C(), c = new T({ path: e, baudRate: 115200 }), c.on("data", (P) => {
                  i && i.webContents.send("terminal-output", P.toString("utf8"));
                }), c.on("error", () => {
                  c = null;
                }), c.on("close", () => {
                  c = null;
                });
              } catch (P) {
                console.error("Could not resume monitor:", P);
              }
              d({
                success: !0,
                message: S.trim() || "Upload complete — device running"
              });
            }
          );
      }, 1e3);
    }))
  ), f.handle(
    "hardware:startMonitor",
    async (r, { port: t, baudRate: e = 115200 }) => {
      if (c)
        return { success: !1, message: "Monitor already running" };
      try {
        return c = new T({ path: t, baudRate: e }), c.on("data", (s) => {
          i && i.webContents.send("terminal-output", s.toString("utf8"));
        }), c.on("error", (s) => {
          console.error("[Serial] Monitor Error:", s.message), i && i.webContents.send("terminal-output", `\x1B[31m[Port Error: ${s.message}]\x1B[0m\r
`), c = null;
        }), c.on("close", () => {
          c = null, i && i.webContents.send("terminal-output", `\x1B[33m[Port Closed]\x1B[0m\r
`);
        }), { success: !0 };
      } catch (s) {
        return { success: !1, message: s.message };
      }
    }
  ), f.handle("hardware:stopMonitor", async () => (await C(), { success: !0 }));
  let p = !1;
  f.handle("hardware:stopExecution", async (r, { port: t }) => p ? { success: !1, message: "Stop already in progress" } : (p = !0, await C(), new Promise((e) => {
    const s = new T({ path: t, baudRate: 115200 }, (n) => {
      if (n)
        return p = !1, e({ success: !1, message: n.message });
      s.write(Buffer.from("\r", "utf-8"), (o) => {
        o && console.error("Error writing break:", o), setTimeout(() => {
          s.close(() => {
            try {
              c = new T({ path: t, baudRate: 115200 }), c.on("data", (l) => {
                i && i.webContents.send("terminal-output", l.toString("utf8"));
              }), c.on("error", () => {
                c = null;
              }), c.on("close", () => {
                c = null;
              });
            } catch (l) {
              console.error("Could not resume monitor automatically:", l);
            }
            p = !1, e({ success: !0 });
          });
        }, 400);
      });
    });
  }))), f.handle("hardware:listFiles", async (r, { port: t }) => D(t, () => new Promise((e) => {
    const s = x(m.join("firmware-tools", "core", "fs_manager.py"));
    b(
      `"${E()}" "${s}" --port ${t} --action list`,
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
  }))), f.handle("hardware:readFile", async (r, { port: t, filePath: e }) => D(t, () => new Promise((s) => {
    const n = x(m.join("firmware-tools", "core", "fs_manager.py"));
    b(
      `"${E()}" "${n}" --port ${t} --action read --path "${e}"`,
      { timeout: 3e4 },
      (o, l, d) => {
        if (o) {
          console.error("[ElectroAI] readFile error:", o.message), s({ error: d || o.message });
          return;
        }
        try {
          const h = JSON.parse(l.trim());
          s(h);
        } catch {
          console.error("[ElectroAI] readFile parse error:", l), s({ error: "Invalid response from device" });
        }
      }
    );
  }))), f.handle(
    "hardware:writeFile",
    async (r, { port: t, filePath: e, content: s }) => D(t, () => new Promise((n) => {
      const o = m.join(
        I.tmpdir(),
        "electro_write_temp_" + Date.now() + ".py"
      );
      try {
        a.writeFileSync(o, s, "utf-8");
      } catch {
        n({ success: !1, message: "Temp file error" });
        return;
      }
      const l = x(m.join("firmware-tools", "core", "fs_manager.py"));
      M(
        E(),
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
        (d, h) => {
          try {
            a.unlinkSync(o);
          } catch {
          }
          d ? (console.error("[ElectroAI] writeFile error:", h || d.message), n({ success: !1, message: h || d.message })) : (console.log("[ElectroAI] writeFile success:", e), n({ success: !0 }));
        }
      );
    }))
  ), f.handle("hardware:deleteFile", async (r, { port: t, filePath: e }) => D(t, () => new Promise((s) => {
    const n = x(m.join("firmware-tools", "core", "fs_manager.py"));
    b(
      `"${E()}" "${n}" --port ${t} --action delete --path "${e}"`,
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
  }))), f.handle("hardware:renameFile", async (r, { port: t, oldPath: e, newPath: s }) => D(t, () => new Promise((n) => {
    const o = x(m.join("firmware-tools", "core", "fs_manager.py"));
    b(
      `"${E()}" "${o}" --port ${t} --action rename --path "${e}" --newpath "${s}"`,
      { timeout: 3e4 },
      (l, d) => {
        if (l) {
          n({ success: !1, message: "Failed to rename device file" });
          return;
        }
        try {
          const h = JSON.parse(d.trim());
          n(h);
        } catch {
          n({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), f.handle("ai:generate", async (r, t) => {
    try {
      const e = m.join(w.getPath("userData"), "config", "settings.json");
      if (!a.existsSync(e))
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      const s = a.readFileSync(e, "utf-8"), n = JSON.parse(s), o = N(n.apiKey), l = JSON.stringify({
        ...t,
        apiConfig: {
          ...n,
          apiKey: o
        }
      });
      return {
        success: !0,
        response_text: (await new Promise((h, g) => {
          const y = A.request(
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
            (u) => {
              let S = "";
              u.on("data", (F) => S += F), u.on("end", () => {
                try {
                  const F = JSON.parse(S);
                  u.statusCode >= 200 && u.statusCode < 300 ? h(F) : g(new Error(F.error || `MCP Server error: ${u.statusCode}`));
                } catch {
                  g(new Error(`MCP Server returned invalid JSON (status ${u.statusCode})`));
                }
              });
            }
          );
          y.on("error", (u) => {
            g(new Error(`Cannot reach MCP Server: ${u.message}. Is it running?`));
          }), y.write(l), y.end();
        })).data
      };
    } catch (e) {
      return console.error("[AiProxy] Generation failed:", e), { success: !1, error: { type: "RUNTIME", message: e.message } };
    }
  }), f.handle("window:minimize", () => {
    i?.minimize();
  }), f.handle("window:maximize", () => {
    i?.isMaximized() ? i.unmaximize() : i?.maximize();
  }), f.handle("window:close", () => {
    i?.close();
  }), f.handle("terminal:sendInput", async (r, t) => {
    if (c && c.isOpen)
      try {
        return c.write(t), { success: !0 };
      } catch (e) {
        return { success: !1, message: e.message };
      }
    return { success: !1, message: "No active serial monitor" };
  }), f.handle("pty:start", async (r, t) => {
    if (_)
      try {
        _.kill();
      } catch {
      }
    const e = I.platform() === "win32" ? "powershell.exe" : "bash";
    try {
      return _ = H.spawn(e, [], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: t || I.homedir(),
        env: process.env
      }), _.onData((s) => {
        i && i.webContents.send("pty:output", s);
      }), { success: !0 };
    } catch (s) {
      return { success: !1, message: s.message };
    }
  }), f.handle("pty:input", async (r, t) => _ ? (_.write(t), { success: !0 }) : { success: !1, message: "No active shell process" }), f.handle("pty:resize", async (r, { cols: t, rows: e }) => _ ? (_.resize(t, e), { success: !0 }) : { success: !1 }), f.handle("firmware:listVolumes", async () => {
    try {
      if (process.platform === "win32")
        return new Promise((r) => {
          b('wmic logicaldisk where "DriveType=2" get DeviceID,VolumeName /format:csv', (t, e) => {
            if (t) {
              r([]);
              return;
            }
            const n = e.trim().split(`
`).filter((o) => o.includes(",")).slice(1).map((o) => {
              const l = o.trim().split(","), d = l[1] || "", h = l[2] || "Removable Disk";
              return { path: d + "\\", label: `${h} (${d})` };
            }).filter((o) => o.path.length > 1);
            r(n);
          });
        });
      if (process.platform === "darwin") {
        const r = "/Volumes";
        return a.existsSync(r) ? a.readdirSync(r).map((e) => ({
          path: m.join(r, e),
          label: e
        })) : [];
      } else {
        const r = I.userInfo().username, t = [`/media/${r}`, `/run/media/${r}`], e = [];
        for (const s of t)
          if (a.existsSync(s))
            for (const n of a.readdirSync(s))
              e.push({ path: m.join(s, n), label: n });
        return e;
      }
    } catch {
      return [];
    }
  }), f.handle("firmware:install", async (r, { sourcePath: t, targetVolume: e }) => {
    try {
      if (!a.existsSync(t))
        return { success: !1, message: "Firmware file not found: " + t };
      const s = m.basename(t), n = m.join(e, s), l = a.statSync(t).size;
      if (l === 0)
        return { success: !1, message: "Firmware file is empty" };
      const d = a.createReadStream(t), h = a.createWriteStream(n);
      let g = 0;
      return d.on("data", (y) => {
        g += y.length;
        const u = Math.round(g / l * 100);
        i && i.webContents.send("firmware-progress", {
          percent: u,
          message: `Copying ${s}... ${u}%`
        });
      }), new Promise((y) => {
        h.on("finish", () => {
          i && i.webContents.send("firmware-progress", {
            percent: 100,
            message: "Firmware installed successfully!",
            done: !0
          }), y({ success: !0 });
        }), h.on("error", (u) => {
          i && i.webContents.send("firmware-progress", {
            percent: 0,
            message: u.message,
            error: u.message
          }), y({ success: !1, message: u.message });
        }), d.on("error", (u) => {
          i && i.webContents.send("firmware-progress", {
            percent: 0,
            message: u.message,
            error: u.message
          }), y({ success: !1, message: u.message });
        }), d.pipe(h);
      });
    } catch (s) {
      return { success: !1, message: s.message };
    }
  }), f.handle("shell:openExternal", async (r, t) => {
    try {
      return await q.openExternal(t), { success: !0 };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), f.handle("firmware:download", async (r, { url: t, fileName: e }) => {
    try {
      const s = m.join(w.getPath("userData"), "firmware-cache");
      a.existsSync(s) || a.mkdirSync(s, { recursive: !0 });
      const n = m.join(s, e);
      return a.existsSync(n) && a.statSync(n).size > 0 ? (console.log(`[Firmware] Using cached: ${n}`), i && i.webContents.send("firmware-progress", {
        percent: 100,
        message: "Using cached firmware file..."
      }), { success: !0, filePath: n }) : new Promise((o) => {
        const l = (h, g = 0) => {
          if (g > 5) {
            o({ success: !1, message: "Too many redirects" });
            return;
          }
          (h.startsWith("https") ? k : A).get(h, (u) => {
            if (u.statusCode >= 300 && u.statusCode < 400 && u.headers.location) {
              const S = u.headers.location;
              (S.startsWith("https") ? k : A).get(S, (P) => {
                if (P.statusCode >= 300 && P.statusCode < 400 && P.headers.location) {
                  l(P.headers.location, g + 2);
                  return;
                }
                d(P);
              }).on("error", (P) => {
                o({ success: !1, message: `Download failed: ${P.message}` });
              });
              return;
            }
            d(u);
          }).on("error", (u) => {
            o({ success: !1, message: `Download failed: ${u.message}` });
          });
        }, d = (h) => {
          if (h.statusCode !== 200) {
            o({ success: !1, message: `Server returned ${h.statusCode}` });
            return;
          }
          const g = parseInt(h.headers["content-length"] || "0", 10);
          let y = 0;
          const u = a.createWriteStream(n);
          h.on("data", (S) => {
            if (y += S.length, g > 0) {
              const F = Math.round(y / g * 100);
              i && i.webContents.send("firmware-progress", {
                percent: F,
                message: `Downloading ${e}... ${(y / 1024 / 1024).toFixed(1)} MB`
              });
            } else
              i && i.webContents.send("firmware-progress", {
                percent: -1,
                message: `Downloading ${e}... ${(y / 1024 / 1024).toFixed(1)} MB`
              });
          }), h.pipe(u), u.on("finish", () => {
            u.close(), console.log(`[Firmware] Downloaded: ${n}`), o({ success: !0, filePath: n });
          }), u.on("error", (S) => {
            a.unlinkSync(n), o({ success: !1, message: S.message });
          });
        };
        l(t);
      });
    } catch (s) {
      return { success: !1, message: s.message };
    }
  });
}
function W(p = 0) {
  const r = x(m.join("mcp-server", "src", "server.js")), t = x("mcp-server");
  if (a.existsSync(r)) {
    console.log(`[ElectroAI] Starting MCP Server at ${r}...`), $ = v(process.execPath, [r], {
      cwd: t,
      stdio: "pipe",
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: "4000",
        WS_PORT: "4001",
        // Ensure require() can find node_modules in the bundled mcp-server
        NODE_PATH: m.join(t, "node_modules")
      }
    });
    const e = m.join(w.getPath("userData"), "mcp_debug.log");
    a.appendFileSync(e, `
--- STARTING MCP SERVER at ${(/* @__PURE__ */ new Date()).toISOString()} ---
`), a.appendFileSync(e, `mcpPath: ${r}
cwd: ${t}
NODE_PATH: ${m.join(t, "node_modules")}
retry: ${p}
`), $.stdout?.on("data", (s) => {
      console.log(`[MCP] ${s}`), a.appendFileSync(e, `[STDOUT] ${s}`);
    }), $.stderr?.on("data", (s) => {
      console.error(`[MCP] ${s}`), a.appendFileSync(e, `[STDERR] ${s}`);
    }), $.on("error", (s) => {
      console.error("[ElectroAI] Failed to start MCP Server:", s), a.appendFileSync(e, `[SPAWN ERROR] ${s.message}
${s.stack}
`);
    }), $.on("close", (s) => {
      console.log(`[ElectroAI] MCP Server exited with code ${s}`), a.appendFileSync(e, `[EXIT] Code ${s}
`), $ = null, s !== 0 && s !== null && p < 3 && (console.log(`[ElectroAI] MCP crashed — restarting (attempt ${p + 1}/3)...`), a.appendFileSync(e, `[RESTART] Attempt ${p + 1}/3
`), setTimeout(() => W(p + 1), 2e3));
    });
  } else {
    console.warn(`[ElectroAI] MCP Server not found at ${r}`);
    const e = m.join(w.getPath("userData"), "mcp_debug.log");
    a.appendFileSync(e, `
[NOT FOUND] ${r}
resourcesPath: ${process.resourcesPath}
isPackaged: ${w.isPackaged}
`);
  }
}
function K() {
  if (c)
    try {
      c.close();
    } catch {
    }
  if (_)
    try {
      _.kill();
    } catch {
    }
  if ($)
    try {
      process.platform === "win32" && $.pid ? L(`taskkill /pid ${$.pid} /T /F`, { stdio: "ignore" }) : $.kill("SIGKILL");
    } catch {
    }
}
w.on("before-quit", () => {
  K();
});
w.on("window-all-closed", () => {
  K(), process.platform !== "darwin" && (w.quit(), i = null);
});
w.on("second-instance", () => {
  i && (i.isMinimized() && i.restore(), i.focus());
});
w.on("activate", () => {
  B.getAllWindows().length === 0 && J();
});
z && w.whenReady().then(() => {
  Q(), W(), J();
});
export {
  ce as MAIN_DIST,
  V as RENDERER_DIST,
  O as VITE_DEV_SERVER_URL
};
