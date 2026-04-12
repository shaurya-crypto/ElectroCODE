import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sendMcpEvent } from "./mcpClient";

// ── Types ──────────────────────────────────────────────────────

export type Theme = "dark" | "light";
export type AIProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "ollama"
  | "huggingface"
  | "groq";
export type SidebarView = "explorer" | "device" | "settings" | null;

export interface APIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // for ollama / openrouter
}

export interface Interpreter {
  id: string;
  label: string;
  chip: string;
  language: "micropython" | "circuitpython" | "arduino" | "c";
  langDisplay: string;
  description: string;
  flashable: boolean;
}

export interface SerialPort {
  path: string;
  manufacturer?: string;
  description?: string;
}

export interface FileTab {
  id: string;
  name: string;
  filePath: string | null; // null = unsaved
  content: string;
  savedContent: string; // track unsaved changes
  language: string;
  source?: "local" | "device";
}

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  filePath: string;
  children?: FileNode[];
  expanded?: boolean;
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  timestamp: number;
}

export interface AISuggestion {
  code: string;
  language: string;
  prompt: string;
}

export interface TerminalInstance {
  id: string;
  name: string;
  lines: string[];
  type: "serial" | "output";
}

// ── Interpreters list ──────────────────────────────────────────

export const ALL_INTERPRETERS: Interpreter[] = [
  {
    id: "pico-mp",
    label: "Raspberry Pi Pico",
    chip: "RP2040",
    language: "micropython",
    langDisplay: "MicroPython",
    description: "Raspberry Pi Pico with MicroPython",
    flashable: true,
  },
  {
    id: "pico-cp",
    label: "Raspberry Pi Pico",
    chip: "RP2040",
    language: "circuitpython",
    langDisplay: "CircuitPython",
    description: "Raspberry Pi Pico with CircuitPython",
    flashable: true,
  },
  {
    id: "picow-mp",
    label: "Raspberry Pi Pico W",
    chip: "RP2040+CYW43",
    language: "micropython",
    langDisplay: "MicroPython",
    description: "Pico W with WiFi/BLE support",
    flashable: true,
  },
  {
    id: "picow-cp",
    label: "Raspberry Pi Pico W",
    chip: "RP2040+CYW43",
    language: "circuitpython",
    langDisplay: "CircuitPython",
    description: "Pico W with CircuitPython",
    flashable: true,
  },
  {
    id: "esp32-mp",
    label: "ESP32",
    chip: "ESP32",
    language: "micropython",
    langDisplay: "MicroPython",
    description: "ESP32 with WiFi and BLE",
    flashable: true,
  },
  {
    id: "esp32-ino",
    label: "ESP32",
    chip: "ESP32",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "ESP32 using Arduino framework",
    flashable: true,
  },
  {
    id: "esp32s3-mp",
    label: "ESP32-S3",
    chip: "ESP32-S3",
    language: "micropython",
    langDisplay: "MicroPython",
    description: "ESP32-S3 with USB native support",
    flashable: true,
  },
  {
    id: "esp8266-mp",
    label: "ESP8266 / NodeMCU",
    chip: "ESP8266",
    language: "micropython",
    langDisplay: "MicroPython",
    description: "ESP8266 with WiFi",
    flashable: true,
  },
  {
    id: "esp8266-ino",
    label: "ESP8266 / NodeMCU",
    chip: "ESP8266",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "ESP8266 using Arduino framework",
    flashable: true,
  },
  {
    id: "uno-ino",
    label: "Arduino Uno",
    chip: "ATmega328P",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "Classic Arduino Uno R3",
    flashable: true,
  },
  {
    id: "nano-ino",
    label: "Arduino Nano",
    chip: "ATmega328P",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "Arduino Nano (old and new bootloader)",
    flashable: true,
  },
  {
    id: "mega-ino",
    label: "Arduino Mega 2560",
    chip: "ATmega2560",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "Arduino Mega with 54 digital pins",
    flashable: true,
  },
  {
    id: "micro-ino",
    label: "Arduino Micro",
    chip: "ATmega32U4",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "Arduino Micro with native USB",
    flashable: true,
  },
  {
    id: "promini-ino",
    label: "Arduino Pro Mini",
    chip: "ATmega328P",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "Arduino Pro Mini 3.3V/5V",
    flashable: true,
  },
  {
    id: "stm32-ino",
    label: "STM32 (Blue Pill)",
    chip: "STM32F103",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "STM32 via Arduino framework",
    flashable: true,
  },
  {
    id: "rp2040-ino",
    label: "RP2040 (Arduino)",
    chip: "RP2040",
    language: "arduino",
    langDisplay: "Arduino (C++)",
    description: "RP2040 via Arduino-Pico core",
    flashable: true,
  },
];

// ── Default state ─────────────────────────────────────────────

const defaultTerminal: TerminalInstance = {
  id: "term-1",
  name: "Serial 1",
  type: "serial",
  lines: ["Electro CODE - Serial Monitor", "Connect to a device to begin.", ""],
};

// defaultTab removed because it is unused

const defaultTree: FileNode[] = [];

// ── Store ─────────────────────────────────────────────────────

interface AppStore {
  // Setup
  setupComplete: boolean;
  apiConfig: APIConfig | null;
  completeSetup: (config: APIConfig) => void;
  updateAPIConfig: (config: APIConfig) => void;
  loadAPIConfig: () => Promise<void>;

  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;
  autoSave: boolean;
  setAutoSave: (v: boolean) => void;

  // View
  sidebarView: SidebarView;
  setSidebarView: (v: SidebarView) => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  aiPanelOpen: boolean;
  toggleAiPanel: () => void;
  aiPanelWidth: number;
  setAiPanelWidth: (w: number) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  interpreterModalOpen: boolean;
  setInterpreterModalOpen: (v: boolean) => void;
  firmwareModalOpen: boolean;
  firmwareModalFamily: 'micropython' | 'circuitpython' | 'arduino' | null;
  openFirmwareModal: (family: 'micropython' | 'circuitpython' | 'arduino') => void;
  closeFirmwareModal: () => void;

  // Device / Interpreter
  interpreter: Interpreter | null;
  setInterpreter: (i: Interpreter | null) => void;
  availablePorts: SerialPort[];
  setAvailablePorts: (ports: SerialPort[]) => void;
  selectedPort: string | null;
  setSelectedPort: (p: string | null) => void;
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  isFlashing: boolean;
  setIsFlashing: (v: boolean) => void;
  isScanning: boolean;
  setScanning: (v: boolean) => void;
  isDeviceBusy: boolean;
  isSilentBusy: boolean;
  busyReason: string;
  lockDevice: (reason: string, silent?: boolean) => boolean;
  unlockDevice: () => void;

  // Tabs / Editor
  tabs: FileTab[];
  activeTabId: string | null;
  setActiveTab: (id: string) => void;
  openTab: (tab: Omit<FileTab, "savedContent">) => void;
  closeTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  updateTabMeta: (id: string, meta: Partial<FileTab>) => void;
  saveTab: (id: string, silent?: boolean) => Promise<void>;
  newUntitledTab: () => void;

  // File Tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  deviceFileTree: FileNode[];
  fetchDeviceFiles: () => Promise<void>;
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
  toggleFolder: (id: string, isDevice?: boolean) => Promise<void>;
  openFolder: (path: string) => void;
  openedFolderPath: string | null;
  refreshLocalFolder: () => Promise<void>;

  // AI
  conversations: Conversation[];
  currentConversationId: string | null;
  addAiMessage: (msg: Omit<AIMessage, "id" | "timestamp">) => void;
  clearAiMessages: () => void;
  newChat: () => void;
  switchChat: (id: string) => void;
  aiLoading: boolean;
  setAiLoading: (v: boolean) => void;
  aiSuggestion: AISuggestion | null;
  setAiSuggestion: (s: AISuggestion | null) => void;
  acceptSuggestion: () => void;
  declineSuggestion: () => void;

  // Terminals
  terminals: TerminalInstance[];
  activeTerminalId: string;
  setActiveTerminal: (id: string) => void;
  addTerminal: () => void;
  closeTerminal: (id: string) => void;
  addTerminalLine: (id: string, line: string) => void;
  clearTerminal: (id: string) => void;
  terminalHeight: number;
  setTerminalHeight: (h: number) => void;
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;

  // Notifications
  notification: {
    msg: string;
    type: "info" | "success" | "error" | "warning";
  } | null;
  showNotification: (
    msg: string,
    type?: "info" | "success" | "error" | "warning",
  ) => void;
  clearNotification: () => void;

  // Error Overlay
  errorOverlay: string | null;
  showErrorOverlay: (msg: string) => void;
  clearErrorOverlay: () => void;

  // Prompts
  promptConfig: { msg: string; defaultValue: string; resolve: (val: string | null) => void } | null;
  showPrompt: (msg: string, defaultValue?: string) => Promise<string | null>;
  resolvePrompt: (val: string | null) => void;


  getFlattenedFiles: () => string[];

  // Execution
  runExecution: () => Promise<void>;
  stopExecution: () => Promise<void>;

  // Save UI
  savePromptOpen: boolean;
  setSavePromptOpen: (v: boolean) => void;
  handleSaveClick: () => void;
  saveToLocal: () => Promise<void>;
  saveToDevice: () => Promise<void>;
}

let untitledCount = 1;
let terminalCount = 1;

const _serialBuf: Record<string, string> = {}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Setup
      setupComplete: false,
      apiConfig: null,
      completeSetup: async (config) => {
        set({ setupComplete: true, apiConfig: config });
        await (window as any).electronAPI.saveApiSettings(config);
      },
      updateAPIConfig: async (config) => {
        set({ apiConfig: config });
        await (window as any).electronAPI.saveApiSettings(config);
      },
      loadAPIConfig: async () => {
        const config = await (window as any).electronAPI.loadApiSettings();
        if (config) {
          set({ apiConfig: config, setupComplete: true });
        }
      },

      // Theme
      theme: "dark",
      setTheme: (t) => {
        document.documentElement.setAttribute("data-theme", t);
        set({ theme: t });
      },
      autoSave: true,
      setAutoSave: (v) => set({ autoSave: v }),

      // View
      sidebarView: "explorer",
      setSidebarView: (v) => set({ sidebarView: v }),
      sidebarWidth: 240,
      setSidebarWidth: (w) =>
        set({ sidebarWidth: Math.max(150, Math.min(500, w)) }),
      aiPanelOpen: true,
      toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      aiPanelWidth: 340,
      setAiPanelWidth: (w) =>
        set({ aiPanelWidth: Math.max(260, Math.min(500, w)) }),
      settingsOpen: false,
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      interpreterModalOpen: false,
      setInterpreterModalOpen: (v) => set({ interpreterModalOpen: v }),
      firmwareModalOpen: false,
      firmwareModalFamily: null,
      openFirmwareModal: (family) => set({ firmwareModalOpen: true, firmwareModalFamily: family }),
      closeFirmwareModal: () => set({ firmwareModalOpen: false, firmwareModalFamily: null }),

      // Device
      interpreter: null,
      setInterpreter: (i) => set({ interpreter: i }),
      availablePorts: [],
      setAvailablePorts: (ports) => set({ availablePorts: ports }),
      selectedPort: "COM11",
      setSelectedPort: (p) => set({ selectedPort: p }),
      isConnected: false,
      setConnected: (v) => {
        set({ isConnected: v });
        if (!v) {
          set({ deviceFileTree: [] });
        } else {
          // Notify MCP of device status
          const interpreter = get().interpreter;
          const port = get().selectedPort;
          if (interpreter && port) {
            sendMcpEvent("device_update", {
              chip: interpreter.chip,
              serial_port: port,
              baud_rate: 115200,
              connected: true
            });
          }
        }
      },
      isScanning: false,
      setScanning: (v: boolean) => set({ isScanning: v }),
      isFlashing: false, // Legacy, use isDeviceBusy for logic check
      setIsFlashing: (v) => set({ isFlashing: v }),
      isDeviceBusy: false,
      isSilentBusy: false,
      busyReason: "",
      lockDevice: (reason, silent = false) => {
        const { isDeviceBusy, busyReason, showNotification } = get();
        if (isDeviceBusy) {
          if (!silent) {
            showNotification(`Device is busy: ${busyReason}`, "warning");
          }
          return false;
        }
        set({ isDeviceBusy: true, isSilentBusy: silent, busyReason: reason });
        return true;
      },
      unlockDevice: () => set({ isDeviceBusy: false, isSilentBusy: false, busyReason: "" }),

      // Error overlay
      errorOverlay: null,
      showErrorOverlay: (msg) => set({ errorOverlay: msg }),
      clearErrorOverlay: () => set({ errorOverlay: null }),

      // Tabs
      tabs: [],
      activeTabId: null,
      setActiveTab: (id) => set({ activeTabId: id }),
      openTab: (tab) => {
        const existing = get().tabs.find(
          (t) => t.id === tab.id || t.filePath === tab.filePath,
        );
        if (existing) {
          set({ activeTabId: existing.id });
        } else {
          const newTab: FileTab = { ...tab, savedContent: tab.content };
          set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
        }
      },
      closeTab: (id) => {
        const tabs = get().tabs.filter((t) => t.id !== id);
        const active =
          get().activeTabId === id
            ? (tabs[tabs.length - 1]?.id ?? null)
            : get().activeTabId;
        set({ tabs, activeTabId: active });
      },
      updateContent: (id, content) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, content } : t)),
        }));
        const tab = get().tabs.find((t) => t.id === id);
        if (tab && tab.filePath && get().autoSave) {
          const win = window as any;
          win._autoSaveTimers = win._autoSaveTimers || {};
          clearTimeout(win._autoSaveTimers[id]);
          win._autoSaveTimers[id] = setTimeout(() => {
            get().saveTab(id, true);
          }, 1000);
        }
      },
      updateTabMeta: (id, meta) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...meta } : t)),
        })),
      saveTab: async (id, silent = false) => {
        const tab = get().tabs.find((t) => t.id === id);
        if (!tab) return;

        const win = window as any;

        // Case 1: Tab has a file path — write directly to disk or device
        if (tab.filePath) {
          if (tab.source === 'device') {
            // Save to chip via serial
            const port = get().selectedPort;
            if (!port) return;
            if (!get().lockDevice(`Saving ${tab.name}`, silent)) {
              if (silent) {
                // If silent auto-save and device busy, reschedule save
                const win = window as any;
                clearTimeout(win._autoSaveTimers[id]);
                win._autoSaveTimers[id] = setTimeout(() => {
                  get().saveTab(id, true);
                }, 1000);
              }
              return;
            }

            try {
              await win.electronAPI?.stopMonitor?.();
              await win.electronAPI?.writeFile?.({ port, filePath: tab.filePath, content: tab.content });
            } catch (e) {
              console.error(e)
            } finally {
              get().unlockDevice();
              await win.electronAPI?.startMonitor?.({ port, baudRate: 115200 });
            }
          } else {
            // Save to local PC
            try {
              await win.electronAPI?.createFile?.({ filePath: tab.filePath, content: tab.content });
            } catch (e) { }
          }
          set((s) => ({
            tabs: s.tabs.map((t) =>
              t.id === id ? { ...t, savedContent: t.content } : t,
            ),
          }));
          if (!silent) get().showNotification(`Saved ${tab.name}`, 'success');
          return;
        }

        // Case 2: No file path — prompt Save As dialog
        try {
          const result = await win.electronAPI?.saveFile?.({ content: tab.content });
          if (result?.success && result?.path) {
            const newName = result.path.split(/[\\/]/).pop() || tab.name;
            set((s) => ({
              tabs: s.tabs.map((t) =>
                t.id === id ? { ...t, filePath: result.path, name: newName, savedContent: t.content } : t,
              ),
            }));
            if (!silent) {
              get().showNotification(`Saved as ${newName}`, 'success');
            }
            get().refreshLocalFolder();
          }
        } catch (e) {
          get().showNotification('Save failed', 'error');
        }
      },
      newUntitledTab: () => {
        untitledCount++;
        const name = `untitled-${untitledCount}.py`;
        const tab: FileTab = {
          id: `untitled-${untitledCount}`,
          name,
          filePath: null,
          content: "",
          savedContent: "",
          language: "python",
          source: "local",
        };
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
      },

      // File Tree
      fileTree: defaultTree,
      setFileTree: (tree) => set({ fileTree: tree }),
      deviceFileTree: [],
      fetchDeviceFiles: async () => {
        const port = get().selectedPort;
        const isConn = get().isConnected;
        if (!isConn || !port) {
          set({ deviceFileTree: [] });
          return;
        }
        if (!get().lockDevice("Reading device files")) return;

        try {
          // Stop monitor so we can safely access the port
          await (window as any).electronAPI.stopMonitor();

          const files = await (window as any).electronAPI.listFiles({ port });
          if (Array.isArray(files)) {
            const children = files.map((f: any) => ({
              id: "dev-" + f.name,
              name: f.name,
              type: f.type,
              filePath: "/" + f.name,
            }));
            set({
              deviceFileTree: [
                {
                  id: "device-root",
                  name: get().interpreter?.label || "Device Files",
                  type: "folder",
                  filePath: "/",
                  expanded: true,
                  children,
                },
              ],
            });
          }
        } catch (e) {
          console.error("Failed to fetch device files", e);
        } finally {
          get().unlockDevice();
          // Restart monitor
          await (window as any).electronAPI.startMonitor({ port, baudRate: 115200 });
        }
      },
      selectedFileId: null,
      setSelectedFileId: (id) => set({ selectedFileId: id }),
      toggleFolder: async (id, isDevice = false) => {
        const state = get();
        // Helper to find and mutate the tree
        async function fetchChildrenIfNeeded(nodes: FileNode[]): Promise<FileNode[]> {
          const result = [...nodes];
          for (let i = 0; i < result.length; i++) {
            const n = { ...result[i] };
            result[i] = n;
            if (n.id === id) {
              const expanding = !n.expanded;
              n.expanded = expanding;
              // If expanding a local folder that has no children loaded yet
              if (expanding && !isDevice && (!n.children || n.children.length === 0)) {
                try {
                  const fetched = await (window as any).electronAPI.readDir({ dirPath: n.filePath });
                  n.children = fetched || [];
                } catch {
                  n.children = [];
                }
              }
            } else if (n.children) {
              n.children = await fetchChildrenIfNeeded(n.children);
            }
          }
          return result;
        }

        if (isDevice) {
          // Device tree lazy loading not fully implemented, just toggle state
          function toggleSync(nodes: FileNode[]): FileNode[] {
            return nodes.map((n) => {
              if (n.id === id) return { ...n, expanded: !n.expanded };
              if (n.children) return { ...n, children: toggleSync(n.children) };
              return n;
            });
          }
          set({ deviceFileTree: toggleSync(state.deviceFileTree) });
        } else {
          const newTree = await fetchChildrenIfNeeded(state.fileTree);
          set({ fileTree: newTree });
        }
      },
      openFolder: async (pathInput) => {
        let targetPath = pathInput;

        if (!targetPath) {
          const result = await (window as any).electronAPI.openFolder();

          if (typeof result === "object" && result?.folderPath) {
            targetPath = result.folderPath;
          } else {
            targetPath = result;
          }
        }

        console.log("📂 Final Path:", targetPath);

        if (!targetPath || typeof targetPath !== "string") {
          console.error("❌ Invalid folder path:", targetPath);
          return;
        }

        const tree = await (window as any).electronAPI.readDir({
          dirPath: targetPath,
        });

        set({
          openedFolderPath: targetPath,
          fileTree: [
            {
              id: targetPath,
              name: targetPath.split(/[/\\]/).pop() || targetPath,
              type: "folder",
              filePath: targetPath,
              children: tree || [],
            },
          ],
        });
      },
      openedFolderPath: null,
      refreshLocalFolder: async () => {
        const p = get().openedFolderPath;
        if (p) {
          const tree = await (window as any).electronAPI.readDir({
            dirPath: p,
          });
          set({
            fileTree: [
              {
                id: p,
                name: p.split(/[/\\]/).pop() || p,
                type: "folder",
                filePath: p,
                expanded: true,
                children: tree || [],
              },
            ],
          });
        }
      },

      // AI
      conversations: [],
      currentConversationId: null,
      addAiMessage: (msg) => {
        const { currentConversationId, conversations } = get();
        let chatId = currentConversationId;

        // Auto-create if none
        if (!chatId) {
          chatId = `chat-${Date.now()}`;
          const newConv: Conversation = {
            id: chatId,
            title: `Chat ${new Date().toLocaleTimeString()}`,
            messages: [],
            timestamp: Date.now()
          };
          set({ conversations: [...conversations, newConv], currentConversationId: chatId });
        }

        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, { ...msg, id: `msg-${Date.now()}`, timestamp: Date.now() }] }
              : c
          ),
        }));
      },
      clearAiMessages: () => {
        const { currentConversationId } = get();
        if (!currentConversationId) return;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === currentConversationId ? { ...c, messages: [] } : c
          ),
        }));
      },
      newChat: () => {
        const chatId = `chat-${Date.now()}`;
        const newConv: Conversation = {
          id: chatId,
          title: `Chat ${new Date().toLocaleTimeString()}`,
          messages: [],
          timestamp: Date.now()
        };
        set((s) => ({
          conversations: [newConv, ...s.conversations],
          currentConversationId: chatId
        }));
      },
      switchChat: (id) => set({ currentConversationId: id }),
      aiLoading: false,
      setAiLoading: (v) => set({ aiLoading: v }),
      aiSuggestion: null,
      setAiSuggestion: (s) => set({ aiSuggestion: s }),
      acceptSuggestion: () => {
        const { aiSuggestion, activeTabId } = get();
        if (!aiSuggestion || !activeTabId) return;
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId ? { ...t, content: aiSuggestion.code } : t,
          ),
          aiSuggestion: null,
        }));
        get().showNotification("Suggestion accepted", "success");
      },
      declineSuggestion: () => {
        set({ aiSuggestion: null });
        get().showNotification("Suggestion declined", "info");
      },

      // Terminals
      terminals: [defaultTerminal],
      activeTerminalId: defaultTerminal.id,
      setActiveTerminal: (id) => set({ activeTerminalId: id }),
      addTerminal: () => {
        terminalCount++;
        const t: TerminalInstance = {
          id: `term-${terminalCount}`,
          name: `Serial ${terminalCount}`,
          type: "serial",
          lines: ["New terminal session.", ""],
        };
        set((s) => ({
          terminals: [...s.terminals, t],
          activeTerminalId: t.id,
        }));
      },
      closeTerminal: (id) => {
        const terminals = get().terminals.filter((t) => t.id !== id);
        if (terminals.length === 0) {
          terminalCount++;
          const t: TerminalInstance = {
            id: `term-${terminalCount}`,
            name: `Serial ${terminalCount}`,
            type: "serial",
            lines: [""],
          };
          set({ terminals: [t], activeTerminalId: t.id });
        } else {
          const active =
            get().activeTerminalId === id
              ? terminals[terminals.length - 1]!.id
              : get().activeTerminalId;
          set({ terminals, activeTerminalId: active });
        }
      },
      addTerminalLine: (id, text) => {
        if (text === undefined || text === null) return;
        _serialBuf[id] = (_serialBuf[id] ?? '') + text
        const parts = _serialBuf[id].split(/\r?\n/)
        _serialBuf[id] = parts.pop() ?? ''   // keep the incomplete tail

        if (parts.length === 0) return        // nothing complete yet

        parts.forEach(line => sendMcpEvent("telemetry_tick", { line }));

        set((s) => ({
          terminals: s.terminals.map((t) =>
            t.id === id ? { ...t, lines: [...t.lines, ...parts] } : t,
          ),
        }));
      },
      clearTerminal: (id) =>
        set((s) => ({
          terminals: s.terminals.map((t) =>
            t.id === id ? { ...t, lines: [] } : t,
          ),
        })),
      terminalHeight: 200,
      setTerminalHeight: (h) =>
        set({ terminalHeight: Math.max(80, Math.min(600, h)) }),
      terminalOpen: true,
      setTerminalOpen: (v) => set({ terminalOpen: v }),

      // Notifications
      notification: null,
      showNotification: (msg, type = "info") => {
        set({ notification: { msg, type } });
        setTimeout(() => set({ notification: null }), 3500);
      },
      clearNotification: () => set({ notification: null }),

      // Prompts
      promptConfig: null,
      showPrompt: (msg, defaultValue = '') => {
        return new Promise((resolve) => {
          set({ promptConfig: { msg, defaultValue, resolve } });
        });
      },
      resolvePrompt: (val) => {
        const { promptConfig } = get();
        if (promptConfig) {
          promptConfig.resolve(val);
          set({ promptConfig: null });
        }
      },
      // Helpers
      getFlattenedFiles: () => {
        const { fileTree, tabs } = get();
        const results: Set<string> = new Set();

        // Add open tabs
        tabs.forEach(t => results.add(t.name));

        // Recursive tree walk
        function walk(nodes: FileNode[]) {
          for (const node of nodes) {
            if (node.type === 'file') {
              results.add(node.name);
            } else if (node.children) {
              walk(node.children);
            }
          }
        }
        walk(fileTree);

        return Array.from(results);
      },

      // Execution
      runExecution: async () => {
        const state = get();
        const {
          isConnected, activeTabId, tabs, selectedPort, interpreter,
          activeTerminalId, showNotification,
          addTerminalLine, clearTerminal, setTerminalOpen, setIsFlashing
        } = state;

        if (!isConnected || !selectedPort || !interpreter) {
          showNotification('Not connected to a device. Please select a port.', 'error');
          return;
        }

        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (!activeTab) return;

        // Auto-stop if already running
        if (state.isFlashing) {
          await state.stopExecution();
          // yield an event loop tick to let UI and state update
          await new Promise(r => setTimeout(r, 100));
        }

        clearTerminal(activeTerminalId);
        setTerminalOpen(true);
        setIsFlashing(true);

        addTerminalLine(activeTerminalId, `> Running ${activeTab.name}...`);
        addTerminalLine(activeTerminalId, '');

        try {
          const response = await (window as any).electronAPI.flash({
            code: activeTab.content,
            port: selectedPort,
            language: interpreter.language,
            boardId: interpreter.id,
            deviceName: activeTab.name,
            mode: 'run'
          });

          if (response.success) {
            // Monitor is started by the flash call itself via spawn/exec
          } else {
            if (response.message) {
              addTerminalLine(activeTerminalId, `❌ Error: ${response.message}`);
            }
          }
        } catch (err: any) {
          addTerminalLine(activeTerminalId, `❌ Error: ${err.message || String(err)}`);
        } finally {
          setIsFlashing(false);
          addTerminalLine(activeTerminalId, '');
          addTerminalLine(activeTerminalId, '>>>');
        }
      },

      stopExecution: async () => {
        const state = get();
        if (!state.isConnected || !state.selectedPort) return;
        try {
          if ((window as any).electronAPI?.stopExecution) {
            await (window as any).electronAPI.stopExecution({ port: state.selectedPort });
          }
          state.addTerminalLine(state.activeTerminalId, '');
          state.addTerminalLine(state.activeTerminalId, 'KeyboardInterrupt');
          state.addTerminalLine(state.activeTerminalId, '>>>');
          state.setIsFlashing(false);
        } catch (e: any) {
          console.error("Stop execution failed", e);
        }
      },

      // Save UI
      savePromptOpen: false,
      setSavePromptOpen: (v) => set({ savePromptOpen: v }),

      handleSaveClick: () => {
        const state = get();
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (!activeTab) return;

        if (activeTab.source === 'device') {
          state.saveToDevice();
        } else if (activeTab.source === 'local' && activeTab.filePath && !activeTab.filePath.startsWith('/')) {
          state.saveToLocal();
        } else {
          state.setSavePromptOpen(true);
        }
      },

      saveToLocal: async () => {
        const state = get();
        state.setSavePromptOpen(false);
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (!activeTab) return;

        if (activeTab.filePath && activeTab.source !== 'device') {
          try {
            await (window as any).electronAPI.createFile({ filePath: activeTab.filePath, content: activeTab.content });
            state.saveTab(activeTab.id);
          } catch (e) { state.showNotification('Failed to save to local', 'error') }
        } else {
          const result = await (window as any).electronAPI.saveFile({ content: activeTab.content });
          if (result?.success && result.filePath) {
            const name = result.filePath.split(/[/\\]/).pop() || 'untitled';
            state.updateTabMeta(activeTab.id, { name, filePath: result.filePath });
            state.saveTab(activeTab.id);
          }
        }
      },

      saveToDevice: async () => {
        const state = get();
        state.setSavePromptOpen(false);
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (!activeTab) return;

        if (!state.isConnected || !state.selectedPort) {
          state.showNotification('Not connected to a device.', 'error');
          return;
        }

        const defaultName = activeTab.filePath?.startsWith('/') ? activeTab.filePath.replace('/', '') : activeTab.name;
        // Fix: Use a prompt callback or simple prompt fallback. The store exposes showPrompt.
        const name = await state.showPrompt(`Save to ${state.interpreter?.label} as:`, defaultName);
        if (!name) return;

        const devPath = name.startsWith('/') ? name : `/${name}`;

        const fileExists = state.deviceFileTree?.[0]?.children?.some((f: any) => f.filePath === devPath || f.name === name.replace(/^\//, ''));
        if (fileExists) {
          state.addTerminalLine(state.activeTerminalId, `\x1b[33m⚠ Warning: File "${name}" already exists on device. Overwriting...\x1b[0m`);
        }

        state.addTerminalLine(state.activeTerminalId, `> Saving ${devPath} to device...`);
        state.setTerminalOpen(true);

        await (window as any).electronAPI.stopMonitor();

        const response = await (window as any).electronAPI.writeFile({
          port: state.selectedPort,
          filePath: devPath,
          content: activeTab.content
        });

        if (response.success) {
          state.updateTabMeta(activeTab.id, {
            name: name.split('/').pop() || name,
            filePath: devPath,
            source: 'device'
          });
          state.saveTab(activeTab.id);
          state.fetchDeviceFiles();
        } else {
          state.showNotification(`Failed: ${response.message}`, 'error');
        }

        await (window as any).electronAPI.startMonitor({ port: state.selectedPort, baudRate: 115200 });
      }

    }),

    {
      name: "electrocode-storage",
      partialize: (s) => ({
        setupComplete: s.setupComplete,
        // apiConfig excluded: now loaded from secure main-process JSON
        theme: s.theme,
        autoSave: s.autoSave,
        sidebarWidth: s.sidebarWidth,
        aiPanelWidth: s.aiPanelWidth,
        terminalHeight: s.terminalHeight,
        terminalOpen: s.terminalOpen,
        openedFolderPath: s.openedFolderPath,
        selectedPort: s.selectedPort,
        interpreter: s.interpreter,
        conversations: s.conversations,
        currentConversationId: s.currentConversationId,
      }),
      onRehydrateStorage: (state) => {
        // Automatically fetch secure settings on app start
        state?.loadAPIConfig();
      }
    },
  ),
);
