import { app as g, BrowserWindow as O, ipcMain as p, dialog as A, safeStorage as T } from "electron";
import { fileURLToPath as J } from "node:url";
import i from "node:path";
import { exec as x, spawn as E, execFile as b, execSync as j } from "node:child_process";
import l from "node:fs";
import C from "node:os";
const v = i.dirname(J(import.meta.url));
process.env.APP_ROOT = i.join(v, "..");
const R = process.env.VITE_DEV_SERVER_URL, Z = i.join(process.env.APP_ROOT, "dist-electron"), D = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = R ? i.join(process.env.APP_ROOT, "public") : D;
let m, d = null, P = null;
const M = g.requestSingleInstanceLock();
M || g.quit();
function w(a) {
  return g.isPackaged ? i.join(process.resourcesPath, a) : i.join(process.env.APP_ROOT, "..", a);
}
function y() {
  if (process.platform === "win32") {
    const a = i.join(C.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    return l.existsSync(a) ? a : "python";
  }
  try {
    return j("python3 --version", { stdio: "ignore" }), "python3";
  } catch {
    return "python";
  }
}
function G(a) {
  if (!a) return "";
  try {
    return T.isEncryptionAvailable() ? `enc:${T.encryptString(a).toString("base64")}` : (console.warn("[Security] safeStorage not available. Storing in plain-text."), a);
  } catch (r) {
    return console.error("[Security] Encryption failed:", r), a;
  }
}
function k(a) {
  if (!a || !a.startsWith("enc:")) return a;
  try {
    if (T.isEncryptionAvailable()) {
      const r = a.substring(4), e = Buffer.from(r, "base64");
      return T.decryptString(e);
    }
    return a;
  } catch (r) {
    return console.error("[Security] Decryption failed:", r), a;
  }
}
function L() {
  m = new O({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: !1,
    // Frameless window
    icon: g.isPackaged ? i.join(process.resourcesPath, "icon.ico") : i.join(process.env.VITE_PUBLIC, "icon.ico"),
    webPreferences: {
      preload: i.join(v, "preload.js"),
      // Vite plugin-electron compiles preload.ts to .js
      contextIsolation: !0,
      // Security requirement
      nodeIntegration: !1
    }
  }), m.webContents.on("did-finish-load", () => {
    m?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), R ? m.loadURL(R) : m.loadFile(i.join(D, "index.html"));
}
async function $() {
  return new Promise((a) => {
    if (!d) return a(!0);
    const r = d;
    d = null;
    let e = !1;
    const t = () => {
      e || (e = !0, setTimeout(() => a(!0), 500));
    };
    if (r.once("close", t), r.once("exit", t), r.once("error", t), process.platform === "win32" && r.pid) {
      try {
        j(`taskkill /pid ${r.pid} /T /F`, { stdio: "ignore" });
      } catch {
      }
      setTimeout(t, 1e3);
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
        t();
      }, 3e3);
    }
  });
}
async function I(a, r) {
  return await $(), await r();
}
function z() {
  p.handle("dialog:openFolder", async () => {
    const { canceled: r, filePaths: e } = await A.showOpenDialog({
      properties: ["openDirectory"]
    });
    return r ? null : e[0];
  }), p.handle("dialog:openFile", async () => {
    const { canceled: r, filePaths: e } = await A.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Code Files", extensions: ["py", "js", "ts", "json", "html", "css", "md", "txt", "c", "cpp", "h", "hpp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (!r && e.length > 0)
      try {
        const t = e[0], n = l.readFileSync(t, "utf-8");
        return {
          path: t,
          name: i.basename(t),
          content: n
        };
      } catch (t) {
        return { error: t.message };
      }
    return null;
  }), p.handle("fs:readDir", async (r, { dirPath: e }) => {
    try {
      return l.existsSync(e) ? l.statSync(e).isDirectory() ? l.readdirSync(e).map((s) => {
        const o = i.join(e, s);
        let u = !1;
        try {
          u = l.statSync(o).isDirectory();
        } catch {
        }
        return {
          id: o,
          name: s,
          type: u ? "folder" : "file",
          filePath: o,
          children: u ? [] : void 0
          // Empty array signifies an unloaded folder
        };
      }).sort((s, o) => s.type === o.type ? s.name.localeCompare(o.name) : s.type === "folder" ? -1 : 1) : [] : [];
    } catch {
      return [];
    }
  }), p.handle("fs:readFile", async (r, { filePath: e }) => {
    try {
      return l.readFileSync(e, "utf-8");
    } catch {
      return null;
    }
  }), p.handle("fs:createFile", async (r, { filePath: e, content: t = "" }) => {
    try {
      return l.writeFileSync(e, t, "utf-8"), { success: !0 };
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), p.handle("fs:createFolder", async (r, { folderPath: e }) => {
    try {
      return l.mkdirSync(e, { recursive: !0 }), { success: !0 };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), p.handle("fs:delete", async (r, { filePath: e }) => {
    try {
      return l.rmSync(e, { recursive: !0, force: !0 }), { success: !0 };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), p.handle("fs:rename", async (r, { oldPath: e, newPath: t }) => {
    try {
      return l.renameSync(e, t), { success: !0 };
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), p.handle("saveApiSettings", async (r, e) => {
    try {
      const t = i.join(g.getPath("userData"), "config");
      l.existsSync(t) || l.mkdirSync(t, { recursive: !0 });
      const n = i.join(t, "settings.json"), s = {
        ...e,
        apiKey: G(e.apiKey),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return l.writeFileSync(n, JSON.stringify(s, null, 2), "utf-8"), { success: !0, path: n };
    } catch (t) {
      return { success: !1, message: t.message };
    }
  }), p.handle("loadApiSettings", async () => {
    try {
      const r = i.join(g.getPath("userData"), "config", "settings.json");
      if (!l.existsSync(r)) return null;
      const e = l.readFileSync(r, "utf-8"), t = JSON.parse(e);
      return {
        ...t,
        apiKey: k(t.apiKey)
      };
    } catch {
      return null;
    }
  }), p.handle("hardware:listPorts", async () => new Promise((r) => {
    x(
      `"${y()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
      { timeout: 1e4 },
      (e, t) => {
        if (e) {
          r([]);
          return;
        }
        try {
          const n = JSON.parse(t.trim());
          r(n);
        } catch {
          console.error(
            "[ElectroAI] Could not parse port list. stdout:",
            t
          ), r([]);
        }
      }
    );
  })), p.handle("hardware:checkChip", async (r, { port: e }) => (await $(), new Promise((t) => {
    let n = !1;
    const s = (h) => {
      n || (n = !0, t(h));
    }, o = E(y(), [
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
    let u = "", c = "";
    o.stdout.on("data", (h) => u += h.toString()), o.stderr.on("data", (h) => c += h.toString()), o.on("error", (h) => {
      console.error("[ElectroAI] spawn error:", h.message), s({
        connected: !1,
        message: "Python not found. Install Python and pyserial."
      });
    }), o.on("close", (h) => {
      if (console.log(
        `[ElectroAI] checkChip python exited code=${h}, stdout="${u.trim()}", stderr="${c.trim()}"`
      ), u.trim() === "ok")
        s({ connected: !0 });
      else {
        const F = c.trim() || `Could not open ${e}. Check USB cable, drivers, and close other serial tools.`;
        s({ connected: !1, message: F });
      }
    });
    const f = setTimeout(() => {
      o.kill(), s({
        connected: !1,
        message: `Timeout — no response from ${e}.`
      });
    }, 8e3);
    o.on("close", () => clearTimeout(f));
  }))), p.handle("dialog:saveFile", async (r, { content: e, defaultName: t }) => {
    const { canceled: n, filePath: s } = await A.showSaveDialog({
      defaultPath: t ?? "untitled.py",
      filters: [
        { name: "Python", extensions: ["py"] },
        { name: "C/C++", extensions: ["c", "cpp", "ino", "h"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (n || !s) return { success: !1 };
    try {
      return l.writeFileSync(s, e, "utf-8"), { success: !0, filePath: s, path: s };
    } catch (o) {
      return { success: !1, message: o.message };
    }
  }), p.handle(
    "hardware:flash",
    async (r, { code: e, port: t, language: n, boardId: s, deviceName: o, mode: u }) => (await $(), await new Promise((c) => {
      const f = `
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
      E(y(), ["-c", f]).on("close", c);
    }), new Promise((c) => {
      const f = i.join(C.tmpdir(), "electro_temp.py");
      try {
        l.writeFileSync(f, e, "utf-8");
      } catch {
        c({ success: !1, message: "Failed to write temp file" });
        return;
      }
      setTimeout(() => {
        const F = [
          w(i.join("firmware-tools", "core", "uploader.py")),
          "--port",
          t,
          "--file",
          f,
          "--language",
          n,
          "--board-id",
          s ?? "arduino:avr:uno"
        ];
        if (o && F.push("--device-name", o), u && F.push("--mode", u), u === "run") {
          const _ = E(y(), F);
          d = _, _.stdout?.on("data", (S) => {
            m && m.webContents.send("terminal-output", S.toString("utf8"));
          }), _.stderr?.on("data", (S) => {
            m && m.webContents.send("terminal-output", S.toString("utf8"));
          }), _.on("close", (S) => {
            d === _ && (d = null), c(S === 0 || S === null ? { success: !0, message: "Execution finished" } : { success: !1, message: "" });
          });
        } else
          b(
            y(),
            F,
            { timeout: 6e4 },
            (_, S, U) => {
              if (_) {
                c({
                  success: !1,
                  message: U.trim() || S.trim() || _.message
                });
                return;
              }
              const V = w(i.join("firmware-tools", "serial", "monitor.py"));
              d = E(y(), [
                V,
                "--port",
                t,
                "--baud",
                "115200"
              ]), d.stdout?.on("data", (K) => {
                m && m.webContents.send("terminal-output", K.toString("utf8"));
              }), d.stderr?.on("data", () => {
              }), d.on("close", () => {
                d = null;
              }), c({
                success: !0,
                message: S.trim() || "Upload complete — device running"
              });
            }
          );
      }, 1e3);
    }))
  ), p.handle(
    "hardware:startMonitor",
    async (r, { port: e, baudRate: t = 115200 }) => {
      if (d)
        return { success: !1, message: "Monitor already running" };
      const n = w(i.join("firmware-tools", "serial", "monitor.py"));
      return d = E(y(), [
        n,
        "--port",
        e,
        "--baud",
        t.toString()
      ]), d.stdout?.on("data", (s) => {
        m && m.webContents.send("terminal-output", s.toString("utf8"));
      }), d.stderr?.on("data", (s) => {
        console.error(`Monitor Error: ${s}`);
      }), d.on("close", () => {
        d = null;
      }), { success: !0 };
    }
  ), p.handle("hardware:stopMonitor", async () => (await $(), { success: !0 }));
  let a = !1;
  p.handle("hardware:stopExecution", async (r, { port: e }) => a ? { success: !1, message: "Stop already in progress" } : (a = !0, await $(), new Promise((t) => {
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
    E(y(), ["-c", n]).on("close", () => {
      const o = w(i.join("firmware-tools", "serial", "monitor.py"));
      d = E(y(), [o, "--port", e, "--baud", "115200"]), d.stdout?.on("data", (u) => {
        m && m.webContents.send("terminal-output", u.toString("utf8"));
      }), d.stderr?.on("data", (u) => {
        console.error(`Monitor Error: ${u}`);
      }), d.on("close", () => {
        d = null;
      }), a = !1, t({ success: !0 });
    });
  }))), p.handle("hardware:listFiles", async (r, { port: e }) => I(e, () => new Promise((t) => {
    const n = w(i.join("firmware-tools", "core", "fs_manager.py"));
    x(
      `"${y()}" "${n}" --port ${e} --action list`,
      { timeout: 3e4 },
      (s, o) => {
        if (s) {
          console.error("[ElectroAI] listFiles error:", s.message), t({ error: "Failed to read device" });
          return;
        }
        try {
          const u = JSON.parse(o.trim());
          t(u);
        } catch {
          console.error("[ElectroAI] listFiles parse error:", o), t({ error: "Invalid data from device" });
        }
      }
    );
  }))), p.handle("hardware:readFile", async (r, { port: e, filePath: t }) => I(e, () => new Promise((n) => {
    const s = w(i.join("firmware-tools", "core", "fs_manager.py"));
    x(
      `"${y()}" "${s}" --port ${e} --action read --path "${t}"`,
      { timeout: 3e4 },
      (o, u, c) => {
        if (o) {
          console.error("[ElectroAI] readFile error:", o.message), n({ error: c || o.message });
          return;
        }
        try {
          const f = JSON.parse(u.trim());
          n(f);
        } catch {
          console.error("[ElectroAI] readFile parse error:", u), n({ error: "Invalid response from device" });
        }
      }
    );
  }))), p.handle(
    "hardware:writeFile",
    async (r, { port: e, filePath: t, content: n }) => I(e, () => new Promise((s) => {
      const o = i.join(
        C.tmpdir(),
        "electro_write_temp_" + Date.now() + ".py"
      );
      try {
        l.writeFileSync(o, n, "utf-8");
      } catch {
        s({ success: !1, message: "Temp file error" });
        return;
      }
      const u = w(i.join("firmware-tools", "core", "fs_manager.py"));
      b(
        y(),
        [
          u,
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
        (c, f) => {
          try {
            l.unlinkSync(o);
          } catch {
          }
          c ? (console.error("[ElectroAI] writeFile error:", f || c.message), s({ success: !1, message: f || c.message })) : (console.log("[ElectroAI] writeFile success:", t), s({ success: !0 }));
        }
      );
    }))
  ), p.handle("hardware:deleteFile", async (r, { port: e, filePath: t }) => I(e, () => new Promise((n) => {
    const s = w(i.join("firmware-tools", "core", "fs_manager.py"));
    x(
      `"${y()}" "${s}" --port ${e} --action delete --path "${t}"`,
      { timeout: 3e4 },
      (o, u) => {
        if (o) {
          n({ success: !1, message: "Failed to delete device file" });
          return;
        }
        try {
          const c = JSON.parse(u.trim());
          n(c);
        } catch {
          n({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), p.handle("hardware:renameFile", async (r, { port: e, oldPath: t, newPath: n }) => I(e, () => new Promise((s) => {
    const o = w(i.join("firmware-tools", "core", "fs_manager.py"));
    x(
      `"${y()}" "${o}" --port ${e} --action rename --path "${t}" --newpath "${n}"`,
      { timeout: 3e4 },
      (u, c) => {
        if (u) {
          s({ success: !1, message: "Failed to rename device file" });
          return;
        }
        try {
          const f = JSON.parse(c.trim());
          s(f);
        } catch {
          s({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), p.handle("ai:generate", async (r, e) => {
    try {
      const t = i.join(g.getPath("userData"), "config", "settings.json");
      if (!l.existsSync(t))
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      const n = l.readFileSync(t, "utf-8"), s = JSON.parse(n), o = k(s.apiKey), c = await fetch("http://127.0.0.1:4000/api/v1/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...e,
          // prompt, sessionId, etc.
          apiConfig: {
            ...s,
            apiKey: o
          }
        })
      });
      if (!c.ok) {
        const h = await c.json().catch(() => ({}));
        throw new Error(h.error || `MCP Server error: ${c.status}`);
      }
      return {
        success: !0,
        response_text: (await c.json()).data
      };
    } catch (t) {
      return console.error("[AiProxy] Generation failed:", t), { success: !1, error: { type: "RUNTIME", message: t.message } };
    }
  }), p.handle("window:minimize", () => {
    m?.minimize();
  }), p.handle("window:maximize", () => {
    m?.isMaximized() ? m.unmaximize() : m?.maximize();
  }), p.handle("window:close", () => {
    m?.close();
  });
}
function W() {
  const a = w(i.join("mcp-server", "src", "server.js"));
  if (l.existsSync(a)) {
    console.log(`[ElectroAI] Starting MCP Server at ${a}...`), P = E(process.execPath, [a], {
      cwd: i.dirname(i.dirname(a)),
      stdio: "pipe",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: "4000", WS_PORT: "4001" }
    });
    const r = i.join(g.getPath("userData"), "mcp_debug.log");
    l.appendFileSync(r, `
--- STARTING MCP SERVER at ${(/* @__PURE__ */ new Date()).toISOString()} ---
`), l.appendFileSync(r, `mcpPath: ${a}
cwd: ${i.dirname(i.dirname(a))}
`), P.stdout?.on("data", (e) => {
      console.log(`[MCP] ${e}`), l.appendFileSync(r, `[STDOUT] ${e}`);
    }), P.stderr?.on("data", (e) => {
      console.error(`[MCP] ${e}`), l.appendFileSync(r, `[STDERR] ${e}`);
    }), P.on("error", (e) => {
      console.error("[ElectroAI] Failed to start MCP Server:", e), l.appendFileSync(r, `[SPAWN ERROR] ${e.message}
${e.stack}
`);
    }), P.on("close", (e) => {
      console.log(`[ElectroAI] MCP Server exited with code ${e}`), l.appendFileSync(r, `[EXIT] Code ${e}
`);
    });
  } else
    console.warn(`[ElectroAI] MCP Server not found at ${a}`);
}
function N() {
  if (d)
    try {
      process.platform === "win32" && d.pid ? j(`taskkill /pid ${d.pid} /T /F`, { stdio: "ignore" }) : d.kill("SIGKILL");
    } catch {
    }
  if (P)
    try {
      process.platform === "win32" && P.pid ? j(`taskkill /pid ${P.pid} /T /F`, { stdio: "ignore" }) : P.kill("SIGKILL");
    } catch {
    }
}
g.on("before-quit", () => {
  N();
});
g.on("window-all-closed", () => {
  N(), process.platform !== "darwin" && (g.quit(), m = null);
});
g.on("second-instance", () => {
  m && (m.isMinimized() && m.restore(), m.focus());
});
g.on("activate", () => {
  O.getAllWindows().length === 0 && L();
});
M && g.whenReady().then(() => {
  z(), W(), L();
});
export {
  Z as MAIN_DIST,
  D as RENDERER_DIST,
  R as VITE_DEV_SERVER_URL
};
