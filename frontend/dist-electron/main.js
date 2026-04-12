import { app as g, BrowserWindow as O, ipcMain as u, dialog as A, safeStorage as $ } from "electron";
import { fileURLToPath as J } from "node:url";
import a from "node:path";
import { exec as F, spawn as _, execFile as b, execSync as T } from "node:child_process";
import f from "node:fs";
import C from "node:os";
const D = a.dirname(J(import.meta.url));
process.env.APP_ROOT = a.join(D, "..");
const v = process.env.VITE_DEV_SERVER_URL, Z = a.join(process.env.APP_ROOT, "dist-electron"), R = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = v ? a.join(process.env.APP_ROOT, "public") : R;
let d, p = null, S = null;
const M = g.requestSingleInstanceLock();
M || g.quit();
function w(i) {
  return g.isPackaged ? a.join(process.resourcesPath, i) : a.join(process.env.APP_ROOT, "..", i);
}
function y() {
  if (process.platform === "win32") {
    const i = a.join(C.homedir(), "AppData", "Local", "Programs", "Thonny", "python.exe");
    return f.existsSync(i) ? i : "python";
  }
  try {
    return T("python3 --version", { stdio: "ignore" }), "python3";
  } catch {
    return "python";
  }
}
function z(i) {
  if (!i) return "";
  try {
    return $.isEncryptionAvailable() ? `enc:${$.encryptString(i).toString("base64")}` : (console.warn("[Security] safeStorage not available. Storing in plain-text."), i);
  } catch (r) {
    return console.error("[Security] Encryption failed:", r), i;
  }
}
function k(i) {
  if (!i || !i.startsWith("enc:")) return i;
  try {
    if ($.isEncryptionAvailable()) {
      const r = i.substring(4), t = Buffer.from(r, "base64");
      return $.decryptString(t);
    }
    return i;
  } catch (r) {
    return console.error("[Security] Decryption failed:", r), i;
  }
}
function L() {
  d = new O({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: !1,
    // Frameless window
    icon: g.isPackaged ? a.join(process.resourcesPath, "icon.ico") : a.join(process.env.VITE_PUBLIC, "icon.ico"),
    webPreferences: {
      preload: a.join(D, "preload.js"),
      // Vite plugin-electron compiles preload.ts to .js
      contextIsolation: !0,
      // Security requirement
      nodeIntegration: !1
    }
  }), d.webContents.on("did-finish-load", () => {
    d?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? d.loadURL(v) : d.loadFile(a.join(R, "index.html"));
}
async function j() {
  return new Promise((i) => {
    if (!p) return i(!0);
    const r = p;
    p = null;
    let t = !1;
    const e = () => {
      t || (t = !0, setTimeout(() => i(!0), 500));
    };
    if (r.once("close", e), r.once("exit", e), r.once("error", e), process.platform === "win32" && r.pid) {
      try {
        T(`taskkill /pid ${r.pid} /T /F`, { stdio: "ignore" });
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
async function I(i, r) {
  return await j(), await r();
}
function G() {
  u.handle("dialog:openFolder", async () => {
    const { canceled: r, filePaths: t } = await A.showOpenDialog({
      properties: ["openDirectory"]
    });
    return r ? null : t[0];
  }), u.handle("dialog:openFile", async () => {
    const { canceled: r, filePaths: t } = await A.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Code Files", extensions: ["py", "js", "ts", "json", "html", "css", "md", "txt", "c", "cpp", "h", "hpp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (!r && t.length > 0)
      try {
        const e = t[0], n = f.readFileSync(e, "utf-8");
        return {
          path: e,
          name: a.basename(e),
          content: n
        };
      } catch (e) {
        return { error: e.message };
      }
    return null;
  }), u.handle("fs:readDir", async (r, { dirPath: t }) => {
    try {
      return f.existsSync(t) ? f.statSync(t).isDirectory() ? f.readdirSync(t).map((s) => {
        const o = a.join(t, s);
        let c = !1;
        try {
          c = f.statSync(o).isDirectory();
        } catch {
        }
        return {
          id: o,
          name: s,
          type: c ? "folder" : "file",
          filePath: o,
          children: c ? [] : void 0
          // Empty array signifies an unloaded folder
        };
      }).sort((s, o) => s.type === o.type ? s.name.localeCompare(o.name) : s.type === "folder" ? -1 : 1) : [] : [];
    } catch {
      return [];
    }
  }), u.handle("fs:readFile", async (r, { filePath: t }) => {
    try {
      return f.readFileSync(t, "utf-8");
    } catch {
      return null;
    }
  }), u.handle("fs:createFile", async (r, { filePath: t, content: e = "" }) => {
    try {
      return f.writeFileSync(t, e, "utf-8"), { success: !0 };
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), u.handle("fs:createFolder", async (r, { folderPath: t }) => {
    try {
      return f.mkdirSync(t, { recursive: !0 }), { success: !0 };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), u.handle("fs:delete", async (r, { filePath: t }) => {
    try {
      return f.rmSync(t, { recursive: !0, force: !0 }), { success: !0 };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), u.handle("fs:rename", async (r, { oldPath: t, newPath: e }) => {
    try {
      return f.renameSync(t, e), { success: !0 };
    } catch (n) {
      return { success: !1, message: n.message };
    }
  }), u.handle("saveApiSettings", async (r, t) => {
    try {
      const e = a.join(g.getPath("userData"), "config");
      f.existsSync(e) || f.mkdirSync(e, { recursive: !0 });
      const n = a.join(e, "settings.json"), s = {
        ...t,
        apiKey: z(t.apiKey),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return f.writeFileSync(n, JSON.stringify(s, null, 2), "utf-8"), { success: !0, path: n };
    } catch (e) {
      return { success: !1, message: e.message };
    }
  }), u.handle("loadApiSettings", async () => {
    try {
      const r = a.join(g.getPath("userData"), "config", "settings.json");
      if (!f.existsSync(r)) return null;
      const t = f.readFileSync(r, "utf-8"), e = JSON.parse(t);
      return {
        ...e,
        apiKey: k(e.apiKey)
      };
    } catch {
      return null;
    }
  }), u.handle("hardware:listPorts", async () => new Promise((r) => {
    F(
      `"${y()}" -c "import json,serial.tools.list_ports;print(json.dumps([{'path':p.device,'description':p.description or '','manufacturer':p.manufacturer or ''} for p in serial.tools.list_ports.comports()]))"`,
      { timeout: 1e4 },
      (t, e) => {
        if (t) {
          r([]);
          return;
        }
        try {
          const n = JSON.parse(e.trim());
          r(n);
        } catch {
          console.error(
            "[ElectroAI] Could not parse port list. stdout:",
            e
          ), r([]);
        }
      }
    );
  })), u.handle("hardware:checkChip", async (r, { port: t }) => (await j(), new Promise((e) => {
    let n = !1;
    const s = (h) => {
      n || (n = !0, e(h));
    }, o = _(y(), [
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
    let c = "", l = "";
    o.stdout.on("data", (h) => c += h.toString()), o.stderr.on("data", (h) => l += h.toString()), o.on("error", (h) => {
      console.error("[ElectroAI] spawn error:", h.message), s({
        connected: !1,
        message: "Python not found. Install Python and pyserial."
      });
    }), o.on("close", (h) => {
      if (console.log(
        `[ElectroAI] checkChip python exited code=${h}, stdout="${c.trim()}", stderr="${l.trim()}"`
      ), c.trim() === "ok")
        s({ connected: !0 });
      else {
        const x = l.trim() || `Could not open ${t}. Check USB cable, drivers, and close other serial tools.`;
        s({ connected: !1, message: x });
      }
    });
    const m = setTimeout(() => {
      o.kill(), s({
        connected: !1,
        message: `Timeout — no response from ${t}.`
      });
    }, 8e3);
    o.on("close", () => clearTimeout(m));
  }))), u.handle("dialog:saveFile", async (r, { content: t, defaultName: e }) => {
    const { canceled: n, filePath: s } = await A.showSaveDialog({
      defaultPath: e ?? "untitled.py",
      filters: [
        { name: "Python", extensions: ["py"] },
        { name: "C/C++", extensions: ["c", "cpp", "ino", "h"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (n || !s) return { success: !1 };
    try {
      return f.writeFileSync(s, t, "utf-8"), { success: !0, filePath: s, path: s };
    } catch (o) {
      return { success: !1, message: o.message };
    }
  }), u.handle(
    "hardware:flash",
    async (r, { code: t, port: e, language: n, boardId: s, deviceName: o, mode: c }) => (await j(), new Promise((l) => {
      const m = a.join(C.tmpdir(), "electro_temp.py");
      try {
        f.writeFileSync(m, t, "utf-8");
      } catch {
        l({ success: !1, message: "Failed to write temp file" });
        return;
      }
      setTimeout(() => {
        const x = [
          w(a.join("firmware-tools", "core", "uploader.py")),
          "--port",
          e,
          "--file",
          m,
          "--language",
          n,
          "--board-id",
          s ?? "arduino:avr:uno"
        ];
        if (o && x.push("--device-name", o), c && x.push("--mode", c), c === "run") {
          const P = _(y(), x);
          p = P, P.stdout?.on("data", (E) => {
            d && d.webContents.send("terminal-output", E.toString("utf8"));
          }), P.stderr?.on("data", (E) => {
            d && d.webContents.send("terminal-output", E.toString("utf8"));
          }), P.on("close", () => {
            p === P && (p = null);
          }), l({ success: !0, message: "Streaming live execution" });
        } else
          b(
            y(),
            x,
            { timeout: 6e4 },
            (P, E, U) => {
              if (P) {
                l({
                  success: !1,
                  message: U.trim() || E.trim() || P.message
                });
                return;
              }
              const K = w(a.join("firmware-tools", "serial", "monitor.py"));
              p = _(y(), [
                K,
                "--port",
                e,
                "--baud",
                "115200"
              ]), p.stdout?.on("data", (V) => {
                d && d.webContents.send("terminal-output", V.toString("utf8"));
              }), p.stderr?.on("data", () => {
              }), p.on("close", () => {
                p = null;
              }), l({
                success: !0,
                message: E.trim() || "Upload complete — device running"
              });
            }
          );
      }, 1e3);
    }))
  ), u.handle(
    "hardware:startMonitor",
    async (r, { port: t, baudRate: e = 115200 }) => {
      if (p)
        return { success: !1, message: "Monitor already running" };
      const n = w(a.join("firmware-tools", "serial", "monitor.py"));
      return p = _(y(), [
        n,
        "--port",
        t,
        "--baud",
        e.toString()
      ]), p.stdout?.on("data", (s) => {
        d && d.webContents.send("terminal-output", s.toString("utf8"));
      }), p.stderr?.on("data", (s) => {
        console.error(`Monitor Error: ${s}`);
      }), p.on("close", () => {
        p = null;
      }), { success: !0 };
    }
  ), u.handle("hardware:stopMonitor", async () => (await j(), { success: !0 }));
  let i = !1;
  u.handle("hardware:stopExecution", async (r, { port: t }) => i ? { success: !1, message: "Stop already in progress" } : (i = !0, await j(), new Promise((e) => {
    const n = `
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
    _(y(), ["-c", n]).on("close", () => {
      const o = w(a.join("firmware-tools", "serial", "monitor.py"));
      p = _(y(), [o, "--port", t, "--baud", "115200"]), p.stdout?.on("data", (c) => {
        d && d.webContents.send("terminal-output", c.toString("utf8"));
      }), p.stderr?.on("data", (c) => {
        console.error(`Monitor Error: ${c}`);
      }), p.on("close", () => {
        p = null;
      }), i = !1, e({ success: !0 });
    });
  }))), u.handle("hardware:listFiles", async (r, { port: t }) => I(t, () => new Promise((e) => {
    const n = w(a.join("firmware-tools", "core", "fs_manager.py"));
    F(
      `"${y()}" "${n}" --port ${t} --action list`,
      { timeout: 3e4 },
      (s, o) => {
        if (s) {
          console.error("[ElectroAI] listFiles error:", s.message), e({ error: "Failed to read device" });
          return;
        }
        try {
          const c = JSON.parse(o.trim());
          e(c);
        } catch {
          console.error("[ElectroAI] listFiles parse error:", o), e({ error: "Invalid data from device" });
        }
      }
    );
  }))), u.handle("hardware:readFile", async (r, { port: t, filePath: e }) => I(t, () => new Promise((n) => {
    const s = w(a.join("firmware-tools", "core", "fs_manager.py"));
    F(
      `"${y()}" "${s}" --port ${t} --action read --path "${e}"`,
      { timeout: 3e4 },
      (o, c, l) => {
        if (o) {
          console.error("[ElectroAI] readFile error:", o.message), n({ error: l || o.message });
          return;
        }
        try {
          const m = JSON.parse(c.trim());
          n(m);
        } catch {
          console.error("[ElectroAI] readFile parse error:", c), n({ error: "Invalid response from device" });
        }
      }
    );
  }))), u.handle(
    "hardware:writeFile",
    async (r, { port: t, filePath: e, content: n }) => I(t, () => new Promise((s) => {
      const o = a.join(
        C.tmpdir(),
        "electro_write_temp_" + Date.now() + ".py"
      );
      try {
        f.writeFileSync(o, n, "utf-8");
      } catch {
        s({ success: !1, message: "Temp file error" });
        return;
      }
      const c = w(a.join("firmware-tools", "core", "fs_manager.py"));
      b(
        y(),
        [
          c,
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
        (l, m) => {
          try {
            f.unlinkSync(o);
          } catch {
          }
          l ? (console.error("[ElectroAI] writeFile error:", m || l.message), s({ success: !1, message: m || l.message })) : (console.log("[ElectroAI] writeFile success:", e), s({ success: !0 }));
        }
      );
    }))
  ), u.handle("hardware:deleteFile", async (r, { port: t, filePath: e }) => I(t, () => new Promise((n) => {
    const s = w(a.join("firmware-tools", "core", "fs_manager.py"));
    F(
      `"${y()}" "${s}" --port ${t} --action delete --path "${e}"`,
      { timeout: 3e4 },
      (o, c) => {
        if (o) {
          n({ success: !1, message: "Failed to delete device file" });
          return;
        }
        try {
          const l = JSON.parse(c.trim());
          n(l);
        } catch {
          n({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), u.handle("hardware:renameFile", async (r, { port: t, oldPath: e, newPath: n }) => I(t, () => new Promise((s) => {
    const o = w(a.join("firmware-tools", "core", "fs_manager.py"));
    F(
      `"${y()}" "${o}" --port ${t} --action rename --path "${e}" --newpath "${n}"`,
      { timeout: 3e4 },
      (c, l) => {
        if (c) {
          s({ success: !1, message: "Failed to rename device file" });
          return;
        }
        try {
          const m = JSON.parse(l.trim());
          s(m);
        } catch {
          s({ success: !1, message: "Invalid output from device" });
        }
      }
    );
  }))), u.handle("ai:generate", async (r, t) => {
    try {
      const e = a.join(g.getPath("userData"), "config", "settings.json");
      if (!f.existsSync(e))
        throw new Error("API Settings not configured. Go to Tools > Settings.");
      const n = f.readFileSync(e, "utf-8"), s = JSON.parse(n), o = k(s.apiKey), l = await fetch("http://localhost:4000/api/v1/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...t,
          // prompt, sessionId, etc.
          apiConfig: {
            ...s,
            apiKey: o
          }
        })
      });
      if (!l.ok) {
        const h = await l.json().catch(() => ({}));
        throw new Error(h.error || `MCP Server error: ${l.status}`);
      }
      return {
        success: !0,
        response_text: (await l.json()).data
      };
    } catch (e) {
      return console.error("[AiProxy] Generation failed:", e), { success: !1, error: { type: "RUNTIME", message: e.message } };
    }
  }), u.handle("window:minimize", () => {
    d?.minimize();
  }), u.handle("window:maximize", () => {
    d?.isMaximized() ? d.unmaximize() : d?.maximize();
  }), u.handle("window:close", () => {
    d?.close();
  });
}
function B() {
  const i = w(a.join("mcp-server", "src", "server.js"));
  f.existsSync(i) ? (console.log(`[ElectroAI] Starting MCP Server at ${i}...`), S = _(process.execPath, [i], {
    stdio: "pipe",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: "4000", WS_PORT: "4001" }
  }), S.stdout?.on("data", (r) => console.log(`[MCP] ${r}`)), S.stderr?.on("data", (r) => console.error(`[MCP] ${r}`)), S.on("error", (r) => {
    console.error("[ElectroAI] Failed to start MCP Server:", r);
  }), S.on("close", (r) => {
    console.log(`[ElectroAI] MCP Server exited with code ${r}`);
  })) : console.warn(`[ElectroAI] MCP Server not found at ${i}`);
}
function N() {
  if (p)
    try {
      process.platform === "win32" && p.pid ? T(`taskkill /pid ${p.pid} /T /F`, { stdio: "ignore" }) : p.kill("SIGKILL");
    } catch {
    }
  if (S)
    try {
      process.platform === "win32" && S.pid ? T(`taskkill /pid ${S.pid} /T /F`, { stdio: "ignore" }) : S.kill("SIGKILL");
    } catch {
    }
}
g.on("before-quit", () => {
  N();
});
g.on("window-all-closed", () => {
  N(), process.platform !== "darwin" && (g.quit(), d = null);
});
g.on("second-instance", () => {
  d && (d.isMinimized() && d.restore(), d.focus());
});
g.on("activate", () => {
  O.getAllWindows().length === 0 && L();
});
M && g.whenReady().then(() => {
  G(), B(), L();
});
export {
  Z as MAIN_DIST,
  R as RENDERER_DIST,
  v as VITE_DEV_SERVER_URL
};
