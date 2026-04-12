import { useState, useRef, useEffect } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { getLanguageFromFilename } from '../../utils/Fileicon'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: false
  disabled?: boolean
}

interface Separator { separator: true }
type MenuEntry = MenuItem | Separator

function isSeparator(e: MenuEntry): e is Separator {
  return (e as Separator).separator === true
}

interface MenuDropdownProps {
  items: MenuEntry[]
  x: number
  y: number
  onClose: () => void
}

function MenuDropdown({ items, x, y, onClose }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="menu-dropdown anim-slide-down"
      style={{ top: y, left: x }}
    >
      {items.map((item, i) => {
        if (isSeparator(item)) return <div key={i} className="menu-separator" />
        return (
          <button
            key={i}
            className="menu-dropdown-item"
            disabled={item.disabled}
            onClick={() => {
              item.action?.()
              onClose()
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}

export default function MenuBar() {
  const {
    closeTab, activeTabId, tabs, saveTab, openTab,
    setTheme, theme, toggleAiPanel,
    terminalOpen, setTerminalOpen, addTerminal,
    setSettingsOpen, setInterpreterModalOpen,
    openFolder, isConnected,
    selectedPort, interpreter,
    activeTerminalId, showNotification, addTerminalLine,
    autoSave, setAutoSave,
    runExecution, stopExecution, handleSaveClick
  } = useAppStore()

useEffect(() => {
    // This function runs every time Python prints something
    const handleTerminalData = (data: string) => {
      // Get the freshest state directly from Zustand
      const store = useAppStore.getState();
      store.addTerminalLine(store.activeTerminalId, data);
    };

    const cleanup = (window as any).electronAPI.onTerminalOutput(handleTerminalData);

    return () => {
      cleanup();
    };
  }, []);

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0 })

  function open(name: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropdownPos({ x: rect.left, y: rect.bottom })
    setOpenMenu(openMenu === name ? null : name)
  }

  function close() { setOpenMenu(null) }

  // ── Menu definitions ────────────────────────────────────────

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const fileMenu: MenuEntry[] = [
    { label: 'New File',          shortcut: 'Ctrl+N', action: async () => {
      const store = useAppStore.getState();
      const base = store.openedFolderPath;
      if (!base) {
        store.newUntitledTab();
        return;
      }
      const name = await store.showPrompt('File name (with extension):');
      if (!name) return;
      const filePath = base.replace(/\\/g, '/') + '/' + name;
      const result = await (window as any).electronAPI?.createFile?.({ filePath, content: '' });
      if (result?.success) {
        await store.refreshLocalFolder();
        store.openTab({
          id: filePath,
          name: name,
          filePath: filePath,
          content: '',
          language: 'python',
          source: 'local'
        });
      } else {
        store.showNotification('Failed to create file', 'error');
      }
    }},
    { label: 'New Folder',        action: () => showNotification('Right-click in Explorer to create a folder', 'info') },
    { separator: true },
    { label: 'Open File...',      shortcut: 'Ctrl+O', action: async () => {
      try {
        const result = await (window as any).electronAPI.openFile()
        if (result && result.content) {
          openTab({ id: result.path, name: result.name, filePath: result.path, content: result.content, language: getLanguageFromFilename(result.name), source: 'local' })
        }
      } catch (e) { showNotification('Failed to open file', 'error') }
    }},
    { label: 'Open Folder...',    shortcut: 'Ctrl+K Ctrl+O', action: async () => {
      const folderPath = await (window as any).electronAPI.openFolder()
      if (folderPath) {
        openFolder(folderPath)
        showNotification(`Opened: ${folderPath}`, 'success')
      }
    }},
    { separator: true },
    { label: 'Save',              shortcut: 'Ctrl+S', action: async () => {
      handleSaveClick()
    }},
    { label: 'Save As...',        shortcut: 'Ctrl+Shift+S', action: async () => {
      if (!activeTab) return
      const result = await (window as any).electronAPI.saveFile({ content: activeTab.content })
      if (result?.success && result.filePath) {
        const name = result.filePath.split(/[/\\]/).pop() || 'untitled'
        useAppStore.getState().updateTabMeta(activeTab.id, { name, filePath: result.filePath })
        saveTab(activeTabId!)
        showNotification('File saved successfully', 'success')
      }
    }},
    { label: autoSave ? '✔ Auto Save' : '  Auto Save', action: () => {
      setAutoSave(!autoSave)
      showNotification(autoSave ? 'Auto Save disabled' : 'Auto Save enabled', 'info')
    }},
    { separator: true },
    { label: `Save to ${interpreter?.chip ?? 'Device'}...`, disabled: !isConnected, action: async () => {
      const state = useAppStore.getState()
      if (!state.activeTabId) return
      await state.saveToDevice()
    }},
    { separator: true },
    { label: 'Close Editor',      shortcut: 'Ctrl+W', action: () => { if (activeTabId) closeTab(activeTabId) }},
    { separator: true },
    { label: 'Exit',              shortcut: 'Alt+F4', action: () => window.close() },
  ]

  const editMenu: MenuEntry[] = [
    { label: 'Undo',              shortcut: 'Ctrl+Z',       action: () => document.execCommand('undo') },
    { label: 'Redo',              shortcut: 'Ctrl+Shift+Z', action: () => document.execCommand('redo') },
    { separator: true },
    { label: 'Cut',               shortcut: 'Ctrl+X',       action: () => document.execCommand('cut') },
    { label: 'Copy',              shortcut: 'Ctrl+C',       action: () => document.execCommand('copy') },
    { label: 'Paste',             shortcut: 'Ctrl+V',       action: () => document.execCommand('paste') },
    { separator: true },
    { label: 'Find',              shortcut: 'Ctrl+F',       action: () => showNotification('Use Ctrl+F inside the editor', 'info') },
    { label: 'Replace',           shortcut: 'Ctrl+H',       action: () => showNotification('Use Ctrl+H inside the editor', 'info') },
    { separator: true },
    { label: 'Select All',        shortcut: 'Ctrl+A',       action: () => document.execCommand('selectAll') },
  ]

  const viewMenu: MenuEntry[] = [
    { label: 'Toggle Sidebar',    shortcut: 'Ctrl+B',       action: () => {
      const { setSidebarView, sidebarView } = useAppStore.getState()
      setSidebarView(sidebarView ? null : 'explorer')
    }},
    { label: 'Toggle Terminal',   shortcut: 'Ctrl+`',       action: () => setTerminalOpen(!terminalOpen) },
    { label: 'Toggle AI Panel',   shortcut: 'Ctrl+Shift+A', action: toggleAiPanel },
    { separator: true },
    { label: 'Explorer',          action: () => useAppStore.getState().setSidebarView('explorer') },
    { label: 'Device & Port',     action: () => useAppStore.getState().setSidebarView('device') },
    { separator: true },
    { label: 'Dark Theme',        action: () => setTheme('dark'), disabled: theme === 'dark' },
    { label: 'Light Theme',       action: () => setTheme('light'), disabled: theme === 'light' },
    { separator: true },
    { label: 'Zoom In',           shortcut: 'Ctrl+=',       action: () => { document.body.style.zoom = (parseFloat(document.body.style.zoom || '1') + 0.1).toString() }},
    { label: 'Zoom Out',          shortcut: 'Ctrl+-',       action: () => { document.body.style.zoom = (parseFloat(document.body.style.zoom || '1') - 0.1).toString() }},
    { label: 'Reset Zoom',        shortcut: 'Ctrl+0',       action: () => { document.body.style.zoom = '1' }},
  ]

  const runMenu: MenuEntry[] = [
    { label: 'Run Current File',  shortcut: 'F5', action: async () => {
      await runExecution()
    }},
    { label: 'Stop',              shortcut: 'F6', action: async () => {
      await stopExecution()
    }},
    { label: 'Upload to Device',  shortcut: 'F7', disabled: !isConnected, action: async () => {
      const state = useAppStore.getState()
      if (!state.activeTabId) return
      await state.saveToDevice()
    }},
    { separator: true },
    { label: 'Flash Firmware...', action: () => {
      useAppStore.getState().openFirmwareModal(interpreter?.language === 'circuitpython' ? 'circuitpython' : 'micropython')
    }},
    { label: 'Open REPL',         disabled: !isConnected, action: async () => {
      addTerminalLine(activeTerminalId, 'Connecting to REPL...')
      setTerminalOpen(true)
      await (window as any).electronAPI.stopMonitor()
      await (window as any).electronAPI.startMonitor({ port: selectedPort })
      addTerminalLine(activeTerminalId, '>>> ')
    }},
  ]

  const toolsMenu: MenuEntry[] = [
    { label: 'Select Interpreter...', action: () => setInterpreterModalOpen(true) },
    { separator: true },
    { label: 'Install MicroPython...',  action: () => {
      useAppStore.getState().openFirmwareModal('micropython')
    }},
    { label: 'Install CircuitPython...', action: () => {
      useAppStore.getState().openFirmwareModal('circuitpython')
    }},
    { label: 'Install Arduino Core...', action: () => {
      useAppStore.getState().openFirmwareModal('arduino')
    }},
    { separator: true },
    { label: 'Package Manager (pip)...', disabled: !isConnected, action: () => {
      showNotification('Package manager: connect firmware-tools', 'info')
    }},
    { label: 'Manage Libraries...', action: () => {
      showNotification('Library manager: connect backend', 'info')
    }},
    { separator: true },
    { label: 'New Terminal',       action: () => { addTerminal(); setTerminalOpen(true); } },
    { separator: true },
    { label: 'Settings',           shortcut: 'Ctrl+,', action: () => setSettingsOpen(true) },
  ]

  const helpMenu: MenuEntry[] = [
    { label: 'Documentation',        action: () => (window as any).electronAPI.openExternal('https://docs.micropython.org/') },
    { label: 'MicroPython Reference', action: () => (window as any).electronAPI.openExternal('https://docs.micropython.org/en/latest/') },
    { label: 'Arduino Reference',    action: () => (window as any).electronAPI.openExternal('https://www.arduino.cc/reference/en/') },
    { separator: true },
    { label: 'Report Issue',         action: () => (window as any).electronAPI.openExternal('https://github.com/shaurya-crypto/ElectroCODE/issues') },
    { label: 'Check for Updates',    action: () => { showNotification('Up to date', 'success') }},
    { separator: true },
    { label: 'About Electro CODE',   action: () => (window as any).electronAPI.openExternal('https://github.com/shaurya-crypto/ElectroCODE') },
  ]

  const menus: { name: string; items: MenuEntry[] }[] = [
    { name: 'File',  items: fileMenu },
    { name: 'Edit',  items: editMenu },
    { name: 'View',  items: viewMenu },
    { name: 'Run',   items: runMenu },
    { name: 'Tools', items: toolsMenu },
    { name: 'Help',  items: helpMenu },
  ]

  return (
    <div className="menubar" style={{ userSelect: 'none', display: 'flex', alignItems: 'center', WebkitAppRegion: 'drag' } as any}>
      {/* App brand */}
      <div style={{
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRight: '1px solid var(--border)',
        height: '100%',
        WebkitAppRegion: 'no-drag'
      } as any}>
        <div style={{
          width: 18, height: 18,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: 'white', letterSpacing: '-0.05em',
        }}>
          EC
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as any}>
        {menus.map(({ name }) => (
          <button
            key={name}
            className={`menu-item ${openMenu === name ? 'open' : ''}`}
            onClick={(e) => open(name, e)}
          >
            {name}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Window Controls */}
      <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as any}>
        <button className="window-control-btn" onClick={() => (window as any).electronAPI.minimize()}>
          <Minus size={14} />
        </button>
        <button className="window-control-btn" onClick={() => (window as any).electronAPI.maximize()}>
          <Square size={12} />
        </button>
        <button className="window-control-btn close" onClick={() => (window as any).electronAPI.close()}>
          <X size={16} />
        </button>
      </div>

      {openMenu && (
        <MenuDropdown
          items={menus.find((m) => m.name === openMenu)!.items}
          x={dropdownPos.x}
          y={dropdownPos.y}
          onClose={close}
        />
      )}
    </div>
  )
}